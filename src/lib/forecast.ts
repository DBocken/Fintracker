/**
 * Forecast Engine – Core (Stufe 1: deterministischer Cashflow)
 *
 * Reine Logik ohne IO. Rechnet **tagesgenau** und zykluskorrekt:
 *  - wiederkehrende Zahlungen entlang ihres echten Rhythmus
 *  - interne Transfers (Net-Worth-neutral, aber liquiditätswirksam)
 *  - variable Ausgaben-Baseline (gleichmäßig über den Monat verteilt)
 *  - geplante Einmalposten
 *  - Sicherheitspuffer, Monatstief und Liquiditätsrisiko
 *
 * Geldbeträge werden intern in Minor Units (Cent) als Integer geführt, um
 * Float-Drift zu vermeiden, und erst bei der Ausgabe in Hauptwährungseinheiten
 * zurückgewandelt.
 */
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  getDate,
  getDay,
  getDaysInMonth,
  isAfter,
  isBefore,
  parseISO,
  startOfMonth,
} from 'date-fns';
import { toMajor, toMinor } from './money';
import { distributeMonthlyByProfile } from './forecast-profile';
import type {
  ForecastAccount,
  ForecastAccountKind,
  ForecastConfig,
  ForecastDailyPoint,
  ForecastInput,
  ForecastInsight,
  ForecastMonthlySummary,
  ForecastResult,
  PlannedForecastEvent,
  ForecastTransfer,
  LiquidityRisk,
  RecurringCadence,
  RecurringFlow,
  ResolvedForecastConfig,
  SinkingFund,
} from './forecast-types';

const ISO = 'yyyy-MM-dd';
const OCCURRENCE_GUARD = 100_000; // Schutz gegen Endlosschleifen

/** Konten, die direkt zahlungsrelevant sind (operatingCash). */
const OPERATING_KINDS: ReadonlySet<ForecastAccountKind> = new Set([
  'checking',
  'cash',
  'wallet',
]);

function isOperating(kind: ForecastAccountKind): boolean {
  return OPERATING_KINDS.has(kind);
}

/**
 * Default-Einstufung als verfügbare Reserve (availableCash): operative Konten
 * sowie Tagesgeld/Sparkonten. Depot, Kredit und Kreditkarte zählen nicht.
 */
function defaultLiquidReserve(kind: ForecastAccountKind): boolean {
  return isOperating(kind) || kind === 'savings';
}

function countsAsAvailable(account: ForecastAccount): boolean {
  return account.liquidReserve ?? defaultLiquidReserve(account.kind);
}

function resolveConfig(config: ForecastConfig = {}): ResolvedForecastConfig {
  const startDate = config.startDate ?? format(new Date(), ISO);
  return {
    startDate,
    months: Math.max(config.months ?? 6, 6),
    safetyBuffer: config.safetyBuffer ?? 0,
    bufferBasis: config.bufferBasis ?? 'operating',
    useDailyProfile: config.useDailyProfile ?? false,
  };
}

/** Verschiebt einen Anker um `n` Schritte gemäß Rhythmus. */
function addCadenceSteps(
  anchor: Date,
  n: number,
  cadence: RecurringCadence,
  intervalDays?: number,
): Date {
  switch (cadence) {
    case 'weekly':
      return addDays(anchor, n * 7);
    case 'biweekly':
      return addDays(anchor, n * 14);
    case 'custom':
      return addDays(anchor, n * Math.max(1, Math.round(intervalDays ?? 30)));
    case 'monthly':
      return addMonths(anchor, n);
    case 'quarterly':
      return addMonths(anchor, n * 3);
    case 'semiannual':
      return addMonths(anchor, n * 6);
    case 'annual':
      return addMonths(anchor, n * 12);
    default:
      return addMonths(anchor, n);
  }
}

/**
 * Erzeugt alle Fälligkeiten eines Rhythmus im Bereich [rangeStart, rangeEnd]
 * (beide inklusive), abgeleitet vom Anker. Berücksichtigt optionale
 * Start-/End-Grenzen. Calendar-Cadences werden immer aus dem Original-Anker
 * berechnet (kein Drift bei Monatsenden).
 */
function occurrencesInRange(
  cadence: RecurringCadence,
  anchor: Date,
  rangeStart: Date,
  rangeEnd: Date,
  options: { intervalDays?: number; startDate?: Date; endDate?: Date } = {},
): Date[] {
  const { intervalDays, startDate, endDate } = options;
  const out: Date[] = [];

  // Kleinste Schrittzahl n (ggf. negativ) finden, sodass die Fälligkeit
  // >= rangeStart liegt.
  let n = 0;
  let guard = 0;
  if (!isBefore(addCadenceSteps(anchor, 0, cadence, intervalDays), rangeStart)) {
    // Anker liegt bereits >= rangeStart -> rückwärts schreiten, solange der
    // vorherige Treffer ebenfalls noch >= rangeStart ist.
    while (
      !isBefore(addCadenceSteps(anchor, n - 1, cadence, intervalDays), rangeStart) &&
      guard++ < OCCURRENCE_GUARD
    ) {
      n--;
    }
  } else {
    while (
      isBefore(addCadenceSteps(anchor, n, cadence, intervalDays), rangeStart) &&
      guard++ < OCCURRENCE_GUARD
    ) {
      n++;
    }
  }

  guard = 0;
  while (guard++ < OCCURRENCE_GUARD) {
    const d = addCadenceSteps(anchor, n, cadence, intervalDays);
    if (isAfter(d, rangeEnd)) break;
    const beforeStart = startDate && isBefore(d, startDate);
    const afterEnd = endDate && isAfter(d, endDate);
    if (!isBefore(d, rangeStart) && !beforeStart && !afterEnd) {
      out.push(d);
    }
    n++;
  }
  return out;
}

/**
 * Öffentlicher Helfer: alle Fälligkeiten eines wiederkehrenden Flows im Bereich
 * [startISO, endISO] (inklusive) als ISO-Strings. Wird vom Insight-Layer für die
 * Risikotreiber-Attribution genutzt.
 */
export function listFlowOccurrences(
  flow: RecurringFlow,
  startISO: string,
  endISO: string,
): string[] {
  const dates = occurrencesInRange(
    flow.cadence,
    parseISO(flow.anchorDate),
    parseISO(startISO),
    parseISO(endISO),
    {
      intervalDays: flow.intervalDays,
      startDate: flow.startDate ? parseISO(flow.startDate) : undefined,
      endDate: flow.endDate ? parseISO(flow.endDate) : undefined,
    },
  );
  return dates.map((d) => format(d, ISO));
}

/**
 * Beitragstermine einer Rücklage: monatlich, verankert am Startdatum, bis zum
 * Tag vor der Fälligkeit (am Fälligkeitstag wird die Ausgabe gebucht).
 */
function sinkingContributionDates(fund: SinkingFund, startISO: string): string[] {
  const start = parseISO(startISO);
  const contribEnd = addDays(parseISO(fund.dueDate), -1);
  if (isBefore(contribEnd, start)) return [];
  return occurrencesInRange('monthly', start, start, contribEnd).map((d) => format(d, ISO));
}

/**
 * Berechnet den erforderlichen monatlichen Beitrag, um den Zielbetrag einer
 * Rücklage bis zur Fälligkeit anzusparen (abzüglich bereits Zurückgelegtem).
 * Der Divisor ist die tatsächliche Anzahl der Beitragstermine – damit stimmen
 * angezeigter Beitrag und tatsächlich gebuchte Summe exakt überein.
 */
export function calculateRequiredContribution(fund: SinkingFund, startISO: string): number {
  const count = Math.max(1, sinkingContributionDates(fund, startISO).length);
  const remaining = Math.max(0, fund.targetAmount - (fund.currentSaved ?? 0));
  return Math.round((remaining / count) * 100) / 100;
}

/**
 * Expandiert Rücklagen in synthetische Beiträge (monatlicher Transfer vom
 * operativen Konto auf das Reservekonto) und – falls gewünscht – die
 * Großausgabe am Fälligkeitstag.
 */
function expandSinkingFunds(
  funds: SinkingFund[],
  startISO: string,
  defaultFundedFrom: string | null,
): { transfers: ForecastTransfer[]; events: PlannedForecastEvent[] } {
  const transfers: ForecastTransfer[] = [];
  const events: PlannedForecastEvent[] = [];

  for (const fund of funds) {
    const fundedFrom = fund.fundedFromAccountId ?? defaultFundedFrom;
    const contribution = calculateRequiredContribution(fund, startISO);
    // Beiträge nur bis zum Tag vor Fälligkeit (am Fälligkeitstag wird gezahlt).
    const contribEnd = format(addDays(parseISO(fund.dueDate), -1), ISO);
    if (fundedFrom && contribution > 0 && contribEnd >= startISO) {
      transfers.push({
        id: `sf-${fund.id}-contrib`,
        name: `Rücklage: ${fund.name}`,
        amount: contribution,
        fromAccountId: fundedFrom,
        toAccountId: fund.accountId,
        cadence: 'monthly',
        anchorDate: startISO,
        endDate: contribEnd,
      });
    }
    if (fund.bookExpenseAtDue ?? true) {
      events.push({
        id: `sf-${fund.id}-expense`,
        name: fund.name,
        amount: -Math.abs(fund.targetAmount),
        date: fund.dueDate,
        accountId: fund.accountId,
        category: fund.category,
      });
    }
  }
  return { transfers, events };
}

/** Mutable Tages-Akkumulator (alles in Cent). */
interface DayBucket {
  inflows: number;
  fixedExpenses: number;
  variableExpenses: number;
  events: number;
  transfersIn: number;
  transfersOut: number;
  /** Saldo-Änderung je Konto an diesem Tag (Cent). */
  accountDeltas: Record<string, number>;
}

function emptyBucket(): DayBucket {
  return {
    inflows: 0,
    fixedExpenses: 0,
    variableExpenses: 0,
    events: 0,
    transfersIn: 0,
    transfersOut: 0,
    accountDeltas: {},
  };
}

/** Ist `d` der letzte Tag seines Monats? */
function isMonthEnd(d: Date): boolean {
  return getDate(d) === getDaysInMonth(d);
}

function bucketFor(map: Map<string, DayBucket>, key: string): DayBucket {
  let b = map.get(key);
  if (!b) {
    b = emptyBucket();
    map.set(key, b);
  }
  return b;
}

function addAccountDelta(bucket: DayBucket, accountId: string, deltaCents: number): void {
  bucket.accountDeltas[accountId] = (bucket.accountDeltas[accountId] ?? 0) + deltaCents;
}

/**
 * Berechnet den deterministischen, tagesgenauen Forecast.
 *
 * @param input  Konten, wiederkehrende Flows, Transfers, variable Baseline, Events.
 * @param config Horizont, Startdatum, Sicherheitspuffer, Puffer-Sicht.
 */
export function calculateDeterministicForecast(
  input: ForecastInput,
  config: ForecastConfig = {},
): ForecastResult {
  const resolved = resolveConfig(config);
  const start = parseISO(resolved.startDate);
  // Ende exklusiv: erster Tag nach dem Horizont.
  const endExclusive = addMonths(start, resolved.months);
  const rangeEnd = addDays(endExclusive, -1);
  const totalDays = differenceInCalendarDays(endExclusive, start);

  const accountById = new Map(input.accounts.map((a) => [a.id, a]));
  const buckets = new Map<string, DayBucket>();

  // 0) Rücklagen in synthetische Beiträge (Transfers) + Großausgaben (Events)
  //    expandieren und mit den expliziten Eingaben zusammenführen.
  const operatingDefault =
    input.accounts.find((a) => a.kind === 'checking')?.id ??
    pickVariableExpenseAccount(input.accounts);
  const expanded = expandSinkingFunds(input.sinkingFunds ?? [], resolved.startDate, operatingDefault);
  const allTransfers = [...(input.transfers ?? []), ...expanded.transfers];
  const allEvents = [...(input.plannedEvents ?? []), ...expanded.events];

  // 1) Wiederkehrende Flows einplanen (zykluskorrekt).
  for (const flow of input.recurringFlows ?? []) {
    if (!accountById.has(flow.accountId)) continue;
    const dates = occurrencesInRange(flow.cadence, parseISO(flow.anchorDate), start, rangeEnd, {
      intervalDays: flow.intervalDays,
      startDate: flow.startDate ? parseISO(flow.startDate) : undefined,
      endDate: flow.endDate ? parseISO(flow.endDate) : undefined,
    });
    const cents = toMinor(flow.amount);
    for (const d of dates) {
      const bucket = bucketFor(buckets, format(d, ISO));
      if (cents >= 0) bucket.inflows += cents;
      else bucket.fixedExpenses += -cents;
      addAccountDelta(bucket, flow.accountId, cents);
    }
  }

  // 2) Variable Ausgaben-Baseline über die Monatstage verteilen. Standardmäßig
  //    gleichmäßig; mit `useDailyProfile` und vorhandenem `dailyProfile`
  //    profilgewichtet (Wochentagsmuster) – in beiden Fällen bleibt die
  //    Monatssumme exakt erhalten. Buchung auf das erste operative Konto.
  const variableAccountId = pickVariableExpenseAccount(input.accounts);
  if (variableAccountId) {
    for (const baseline of input.variableExpenses ?? []) {
      const profile = resolved.useDailyProfile ? baseline.dailyProfile : undefined;
      // Profil-Allokation je Monat (über alle Monatstage) einmal cachen.
      const profileByMonth = new Map<string, number[]>();
      for (let i = 0; i < totalDays; i++) {
        const d = addDays(start, i);
        const monthKey = format(d, 'yyyy-MM');
        const monthlyCents = toMinor(
          baseline.monthlyAmounts?.[monthKey] ??
            baseline.budgetOverride ??
            baseline.monthlyAmount,
        );
        if (monthlyCents <= 0) continue;

        let dailyCents: number;
        if (profile) {
          let alloc = profileByMonth.get(monthKey);
          if (!alloc) {
            const monthStart = startOfMonth(d);
            const dim = getDaysInMonth(d);
            const weekdays = Array.from({ length: dim }, (_, k) => getDay(addDays(monthStart, k)));
            alloc = distributeMonthlyByProfile(monthlyCents, weekdays, profile);
            profileByMonth.set(monthKey, alloc);
          }
          dailyCents = alloc[getDate(d) - 1] ?? 0;
        } else {
          const daysInMonth = getDaysInMonth(d);
          const baseDailyCents = Math.floor(monthlyCents / daysInMonth);
          const remainderCents = monthlyCents - baseDailyCents * daysInMonth;
          // Rest-Cent deterministisch auf die ersten Monatstage verteilen. Damit
          // entspricht die Monatssumme exakt dem Planwert, ohne Float-Drift.
          dailyCents = baseDailyCents + (getDate(d) <= remainderCents ? 1 : 0);
        }

        if (dailyCents === 0) continue;
        const bucket = bucketFor(buckets, format(d, ISO));
        bucket.variableExpenses += dailyCents;
        addAccountDelta(bucket, variableAccountId, -dailyCents);
      }
    }
  }

  // 3) Transfers anwenden (Net-Worth-neutral, liquiditätswirksam).
  for (const transfer of allTransfers) {
    if (!accountById.has(transfer.fromAccountId) || !accountById.has(transfer.toAccountId)) {
      continue;
    }
    for (const d of transferDates(transfer, start, rangeEnd)) {
      const bucket = bucketFor(buckets, format(d, ISO));
      const cents = toMinor(transfer.amount);
      addAccountDelta(bucket, transfer.fromAccountId, -cents);
      addAccountDelta(bucket, transfer.toAccountId, cents);

      // Liquiditäts-Grenze: nur Übergänge in/aus operativen Konten zählen.
      const fromOp = isOperating(accountById.get(transfer.fromAccountId)!.kind);
      const toOp = isOperating(accountById.get(transfer.toAccountId)!.kind);
      if (fromOp && !toOp) bucket.transfersOut += cents;
      else if (!fromOp && toOp) bucket.transfersIn += cents;
    }
  }

  // 4) Geplante Einmalposten.
  for (const event of allEvents) {
    if (!accountById.has(event.accountId)) continue;
    const d = parseISO(event.date);
    if (isBefore(d, start) || isAfter(d, rangeEnd)) continue;
    const bucket = bucketFor(buckets, format(d, ISO));
    const cents = toMinor(event.amount);
    bucket.events += cents;
    addAccountDelta(bucket, event.accountId, cents);
  }

  // 5) Tag-für-Tag simulieren.
  const balances: Record<string, number> = {};
  for (const a of input.accounts) balances[a.id] = toMinor(a.openingBalance);

  const daily: ForecastDailyPoint[] = [];
  let prevOperating = sumOperating(balances, accountById);

  for (let i = 0; i < totalDays; i++) {
    const d = addDays(start, i);
    const key = format(d, ISO);
    const bucket = buckets.get(key) ?? emptyBucket();

    for (const [accountId, delta] of Object.entries(bucket.accountDeltas)) {
      balances[accountId] = (balances[accountId] ?? 0) + delta;
    }

    // Zinsen am Monatsende auf positive Salden gutschreiben (deterministisch).
    let interestCents = 0;
    if (isMonthEnd(d)) {
      for (const account of input.accounts) {
        const rate = account.annualInterestRate ?? 0;
        if (rate <= 0) continue;
        const bal = balances[account.id] ?? 0;
        if (bal <= 0) continue;
        const monthInterest = Math.round((bal * rate) / 1200);
        if (monthInterest === 0) continue;
        balances[account.id] = bal + monthInterest;
        interestCents += monthInterest;
      }
    }

    const operating = sumOperating(balances, accountById);
    const available = sumAvailable(balances, accountById);
    const netWorth = sumAll(balances);
    const basisCents = resolved.bufferBasis === 'available' ? available : operating;
    const bufferCents = toMinor(resolved.safetyBuffer);

    daily.push({
      date: key,
      accountBalances: mapToMajor(balances),
      operatingCash: toMajor(operating),
      availableCash: toMajor(available),
      netWorth: toMajor(netWorth),
      inflows: toMajor(bucket.inflows),
      fixedExpenses: toMajor(bucket.fixedExpenses),
      variableExpenses: toMajor(bucket.variableExpenses),
      events: toMajor(bucket.events),
      interest: toMajor(interestCents),
      outflows: toMajor(bucket.fixedExpenses + bucket.variableExpenses),
      transfersIn: toMajor(bucket.transfersIn),
      transfersOut: toMajor(bucket.transfersOut),
      dailyDelta: toMajor(operating - prevOperating),
      belowSafetyBuffer: basisCents < bufferCents,
    });
    prevOperating = operating;
  }

  const monthly = summarizeMonths(daily);
  const risk = calculateLiquidityRisk(daily, resolved);
  const insights = buildInsights(risk, resolved);

  return { config: resolved, daily, monthly, risk, insights };
}

/** Wählt das Default-Konto für variable Ausgaben (erstes operatives Konto). */
function pickVariableExpenseAccount(accounts: ForecastAccount[]): string | null {
  const operating = accounts.find((a) => isOperating(a.kind));
  return (operating ?? accounts[0])?.id ?? null;
}

/** Fälligkeiten eines Transfers (einmalig oder wiederkehrend). */
function transferDates(transfer: ForecastTransfer, rangeStart: Date, rangeEnd: Date): Date[] {
  if (transfer.cadence && transfer.anchorDate) {
    return occurrencesInRange(transfer.cadence, parseISO(transfer.anchorDate), rangeStart, rangeEnd, {
      intervalDays: transfer.intervalDays,
      startDate: transfer.startDate ? parseISO(transfer.startDate) : undefined,
      endDate: transfer.endDate ? parseISO(transfer.endDate) : undefined,
    });
  }
  if (transfer.date) {
    const d = parseISO(transfer.date);
    if (isBefore(d, rangeStart) || isAfter(d, rangeEnd)) return [];
    return [d];
  }
  return [];
}

function sumOperating(
  balances: Record<string, number>,
  accountById: Map<string, ForecastAccount>,
): number {
  let sum = 0;
  for (const [id, bal] of Object.entries(balances)) {
    const account = accountById.get(id);
    if (account && isOperating(account.kind)) sum += bal;
  }
  return sum;
}

function sumAvailable(
  balances: Record<string, number>,
  accountById: Map<string, ForecastAccount>,
): number {
  let sum = 0;
  for (const [id, bal] of Object.entries(balances)) {
    const account = accountById.get(id);
    if (account && countsAsAvailable(account)) sum += bal;
  }
  return sum;
}

function sumAll(balances: Record<string, number>): number {
  let sum = 0;
  for (const bal of Object.values(balances)) sum += bal;
  return sum;
}

function mapToMajor(balances: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, bal] of Object.entries(balances)) out[id] = toMajor(bal);
  return out;
}

/** Aggregiert die Tages-Timeline zu Monatszusammenfassungen. */
export function summarizeMonths(daily: ForecastDailyPoint[]): ForecastMonthlySummary[] {
  const months: ForecastMonthlySummary[] = [];
  let current: ForecastMonthlySummary | null = null;
  let currentKey = '';

  for (const point of daily) {
    const monthKey = point.date.slice(0, 7); // yyyy-mm
    if (monthKey !== currentKey) {
      if (current) months.push(current);
      currentKey = monthKey;
      current = {
        month: monthKey,
        // Eröffnung = operatingCash vor den Buchungen des ersten Monatstages.
        openingBalance: round2(point.operatingCash - point.dailyDelta),
        income: 0,
        fixedExpenses: 0,
        variableExpenses: 0,
        transfersIn: 0,
        transfersOut: 0,
        events: 0,
        interest: 0,
        closingBalance: point.operatingCash,
        lowestBalance: point.operatingCash,
        lowestBalanceDate: point.date,
        belowSafetyBuffer: false,
      };
    }
    const m = current!;
    m.income = round2(m.income + point.inflows);
    m.fixedExpenses = round2(m.fixedExpenses + point.fixedExpenses);
    m.variableExpenses = round2(m.variableExpenses + point.variableExpenses);
    m.transfersIn = round2(m.transfersIn + point.transfersIn);
    m.transfersOut = round2(m.transfersOut + point.transfersOut);
    m.events = round2(m.events + point.events);
    m.interest = round2(m.interest + point.interest);
    m.closingBalance = point.operatingCash;
    if (point.operatingCash < m.lowestBalance) {
      m.lowestBalance = point.operatingCash;
      m.lowestBalanceDate = point.date;
    }
    if (point.belowSafetyBuffer) m.belowSafetyBuffer = true;
  }
  if (current) months.push(current);
  return months;
}

/** Aggregierte Risiko-Kennzahlen über den gesamten Horizont. */
export function calculateLiquidityRisk(
  daily: ForecastDailyPoint[],
  config: ResolvedForecastConfig,
): LiquidityRisk {
  let lowestBalance = Number.POSITIVE_INFINITY;
  let lowestBalanceDate = config.startDate;
  let minOperating = Number.POSITIVE_INFINITY;
  let minAvailable = Number.POSITIVE_INFINITY;
  let firstBreach: string | null = null;
  let daysBelow = 0;

  const basisOf = (p: ForecastDailyPoint) =>
    config.bufferBasis === 'available' ? p.availableCash : p.operatingCash;

  for (const p of daily) {
    const basis = basisOf(p);
    if (basis < lowestBalance) {
      lowestBalance = basis;
      lowestBalanceDate = p.date;
    }
    if (p.operatingCash < minOperating) minOperating = p.operatingCash;
    if (p.availableCash < minAvailable) minAvailable = p.availableCash;
    if (p.belowSafetyBuffer) {
      daysBelow++;
      if (!firstBreach) firstBreach = p.date;
    }
  }

  return {
    lowestBalance: Number.isFinite(lowestBalance) ? lowestBalance : 0,
    lowestBalanceDate,
    firstBelowSafetyBufferDate: firstBreach,
    daysBelowSafetyBuffer: daysBelow,
    minimumOperatingCash: Number.isFinite(minOperating) ? minOperating : 0,
    minimumAvailableCash: Number.isFinite(minAvailable) ? minAvailable : 0,
    safetyBuffer: config.safetyBuffer,
  };
}

function buildInsights(risk: LiquidityRisk, config: ResolvedForecastConfig): ForecastInsight[] {
  if (risk.firstBelowSafetyBufferDate) {
    return [
      {
        kind: 'below_buffer',
        severity: risk.lowestBalance < 0 ? 'critical' : 'warning',
        date: risk.firstBelowSafetyBufferDate,
        message:
          `Liquidität fällt am ${risk.firstBelowSafetyBufferDate} unter den ` +
          `Sicherheitspuffer (${config.safetyBuffer}). Tiefststand ${round2(
            risk.lowestBalance,
          )} am ${risk.lowestBalanceDate}.`,
      },
    ];
  }
  return [
    {
      kind: 'ok',
      severity: 'info',
      message:
        `Liquidität bleibt über den gesamten Horizont über dem Sicherheitspuffer ` +
        `(${config.safetyBuffer}). Tiefststand ${round2(risk.lowestBalance)} am ` +
        `${risk.lowestBalanceDate}.`,
    },
  ];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Re-Export der wichtigsten Typen für ergonomische Imports.
export type {
  ForecastInput,
  ForecastConfig,
  ForecastResult,
  ForecastDailyPoint,
  ForecastMonthlySummary,
  LiquidityRisk,
} from './forecast-types';
