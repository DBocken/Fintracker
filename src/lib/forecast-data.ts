/**
 * Forecast Engine – Data Adapter (Stufe 1)
 *
 * Übersetzt die echten App-Datenquellen in die reine {@link ForecastInput}-
 * Struktur. Hier – und nur hier – findet IO statt; die Engine selbst
 * (`forecast.ts`) bleibt seiteneffektfrei und testbar.
 *
 * Grundsatz: auto-seeded. Der Forecast baut sich aus echten Konten,
 * wiederkehrenden Zahlungen und Transaktionen auf; manuelle Eingaben sind
 * spätere Overrides, keine Pflicht.
 */
import { addMonths, format, startOfMonth, subMonths } from 'date-fns';
import type { Account, AccountType, Category, Transaction } from '@/types';
import type { ContractRow, Cycle } from '@/components/contracts/contract-types';
import { getAccounts } from '@/services/account-service';
import { getNetWorthBreakdown } from '@/services/net-worth-service';
import { getCategories, getTransactions } from '@/services/transaction-service';
import { getContractDecisionMap, type ContractDecision } from '@/services/contract-decision-service';
import { computeContracts, isActiveForTotals } from '@/lib/contract-derivation';
import { buildDailySpendingProfile } from '@/lib/forecast-profile';
import { buildOccurrenceModel } from '@/lib/finrisk/occurrence-amount';
import { merchantFingerprint } from '@/lib/merchant-fingerprint';
import { normalizeMerchantName } from '@/services/merchant-normalization';
import { detectSalarySeries } from '@/lib/salary-detection';
import {
  getForecastOverrides,
  type ForecastOverrides,
} from '@/services/forecast-overrides-service';
import type {
  ForecastAccount,
  ForecastAccountKind,
  ForecastInput,
  RecurringCadence,
  RecurringFlow,
  VariableExpenseBaseline,
} from './forecast-types';

/** Mappt die App-Kontoart auf die Forecast-Kontoart. */
export function accountTypeToKind(type: AccountType): ForecastAccountKind {
  switch (type) {
    case 'checking':
      return 'checking';
    case 'cash':
      return 'cash';
    case 'wallet':
      return 'wallet';
    case 'savings':
      return 'savings';
    case 'credit_card':
      return 'credit_card';
    default:
      return 'other';
  }
}

/** Mappt den erkannten Vertrags-Zyklus auf eine Forecast-Cadence. */
export function cycleToCadence(cycle: Cycle): RecurringCadence | null {
  switch (cycle) {
    case 'Wöchentlich':
      return 'weekly';
    case 'Monatlich':
      return 'monthly';
    case 'Vierteljährlich':
      return 'quarterly';
    case 'Halbjährlich':
      return 'semiannual';
    case 'Jährlich':
      return 'annual';
    default:
      return null; // Unbekannt -> nicht in den Forecast zwingen
  }
}

/**
 * Baut die Konten-Liste mit echten Startsalden. Salden kommen aus dem
 * Net-Worth-Service (live, sonst aus lokalen Transaktionen summiert).
 */
export function buildForecastAccounts(
  accounts: Account[],
  accountBalances: Record<string, number>,
): ForecastAccount[] {
  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    kind: accountTypeToKind(account.type),
    openingBalance: accountBalances[account.id] ?? (Number(account.opening_balance) || 0),
  }));
}

/**
 * Leitet wiederkehrende Flows aus den erkannten Verträgen ab. Verträge mit
 * unbekanntem Zyklus werden bewusst ausgelassen (keine Scheingenauigkeit).
 * Anschließend werden nutzerseitige Overrides angewendet (aktivieren/deaktivieren,
 * Betrag, End-Datum).
 */
export function buildRecurringFlows(
  contracts: ContractRow[],
  overrides?: Record<string, { enabled?: boolean; amount?: number; endDate?: string }>,
): RecurringFlow[] {
  const flows: RecurringFlow[] = [];
  for (const contract of contracts) {
    // Ausgaben müssen bestätigt sein. Eine zuverlässig erkannte, aktuelle
    // Einnahmenserie darf dagegen schon als transparenter Vorschlag einfließen.
    const isSuggestedIncome =
      contract.type === 'Einnahme' &&
      contract.status === 'candidate' &&
      !contract.stale &&
      contract.cycleKnown;
    if (!isActiveForTotals(contract) && !isSuggestedIncome) continue;
    const cadence = cycleToCadence(contract.cycle);
    if (!cadence) continue;
    const anchorDate = contract.nextDateISO ?? contract.lastDateISO;
    if (!anchorDate) continue;

    const magnitude = Math.abs(contract.amountRecentTypical ?? contract.amountTypical);
    const signed = contract.type === 'Einnahme' ? magnitude : -magnitude;
    const flowOverride = overrides?.[contract.key];

    // Skip disabled flows
    if (flowOverride?.enabled === false) continue;

    flows.push({
      id: contract.key,
      name: contract.payee,
      amount: flowOverride?.amount ?? signed,
      cadence,
      anchorDate: anchorDate.slice(0, 10),
      accountId: '', // wird unten an ein operatives Konto gebunden
      category: contract.categoryName,
      confidence: contract.confirmed ? 1 : 0.6,
      endDate: flowOverride?.endDate,
    });
  }
  return flows;
}

/**
 * Baut ALLE erkannten Vertrag-Flows für die UI-Anzeige – unabhängig vom Status.
 * Beendete/abgelehnte/pausierte Verträge werden mit `disabled: true` markiert,
 * damit sie sichtbar bleiben, aber nicht in die Prognose einfließen.
 * Nutzerseitig abgehakte Flows (`enabled: false`) werden EBENFALLS einbezogen
 * (damit sie in der Liste sichtbar und wieder aktivierbar sind).
 */
export function buildAllContractFlowsForDisplay(
  contracts: ContractRow[],
  overrides?: Record<string, { enabled?: boolean; amount?: number; endDate?: string }>,
): RecurringFlow[] {
  const flows: RecurringFlow[] = [];
  const INACTIVE_STATUSES = new Set(['ended', 'rejected', 'paused', 'archived']);

  for (const contract of contracts) {
    const cadence = cycleToCadence(contract.cycle);
    if (!cadence) continue;
    const anchorDate = contract.nextDateISO ?? contract.lastDateISO;
    if (!anchorDate) continue;

    const magnitude = Math.abs(contract.amountRecentTypical ?? contract.amountTypical);
    const signed = contract.type === 'Einnahme' ? magnitude : -magnitude;
    const flowOverride = overrides?.[contract.key];

    // Auto-deaktiviert wenn Vertragsstatus inaktiv oder veraltet (stale) – aber
    // nicht wenn der Nutzer es explizit selbst deaktiviert hat (das wird in der
    // UI über den Override gesteuert).
    const autoDisabled = INACTIVE_STATUSES.has(contract.status) || contract.stale;

    flows.push({
      id: contract.key,
      name: contract.payee,
      amount: flowOverride?.amount ?? signed,
      cadence,
      anchorDate: anchorDate.slice(0, 10),
      accountId: '',
      category: contract.categoryName,
      confidence: contract.confirmed ? 1 : 0.6,
      endDate: flowOverride?.endDate,
      disabled: autoDisabled ? true : undefined,
    });
  }
  return flows;
}

/**
 * Erkennt Gehalt als eigene Produktdomäne statt als „Einnahmen-Vertrag”.
 * Gruppiert bewusst nach normalisiertem Arbeitgeber und nicht nach IBAN, weil
 * Bank- und CSV-Importe dieselbe Gehaltsserie sonst in Teilgruppen zerlegen können.
 */
export function buildDetectedSalaryFlows(
  transactions: Transaction[],
  overrides?: Record<string, { enabled?: boolean; amount?: number; endDate?: string }>,
  now = new Date(),
): RecurringFlow[] {
  const flows: RecurringFlow[] = [];
  for (const series of detectSalarySeries(transactions, now)) {
    const last = series.monthly.at(-1)!;
    // Repräsentativer Betrag: oberer Median der letzten bis zu drei Monatsbeträge.
    const recentAmounts = series.monthly
      .slice(-3)
      .map((transaction) => Math.abs(Number(transaction.amount)))
      .sort((a, b) => a - b);
    const amount = recentAmounts[Math.floor(recentAmounts.length / 2)];

    const id = `salary:${series.employer}`;
    const flowOverride = overrides?.[id];
    if (flowOverride?.enabled === false) continue;

    flows.push({
      id,
      name: series.payeeLabel,
      amount: flowOverride?.amount ?? amount,
      cadence: 'monthly',
      anchorDate: series.nextDateISO,
      accountId: last.account_id ?? '',
      category: 'Gehalt',
      confidence: series.confidence,
      endDate: flowOverride?.endDate,
    });
  }

  return flows;
}

/**
 * Bindet Flows an ein operatives Konto. Greift in zwei Fällen:
 *  1. Flow trägt kein Konto (Verträge führen keine Konto-Zuordnung), ODER
 *  2. Flow verweist auf ein Konto, das es in der Prognose nicht (mehr) gibt –
 *     z. B. eine erkannte Gehaltsserie, deren Buchungen auf ein gelöschtes/
 *     archiviertes Konto zeigen.
 *
 * Ohne (2) würde ein solcher Flow auf ein „Phantomkonto" buchen und in der
 * Engine spurlos verschwinden: Das Einkommen wäre erkannt, aber weder im
 * operativen noch im verfügbaren Bestand sichtbar. Default: erstes Girokonto.
 */
function bindFlowsToDefaultAccount(
  flows: RecurringFlow[],
  accounts: ForecastAccount[],
): RecurringFlow[] {
  const defaultAccount =
    accounts.find((a) => a.kind === 'checking') ?? accounts[0];
  if (!defaultAccount) return flows;
  const knownAccountIds = new Set(accounts.map((a) => a.id));
  return flows.map((flow) =>
    flow.accountId && knownAccountIds.has(flow.accountId)
      ? flow
      : { ...flow, accountId: defaultAccount.id },
  );
}

/**
 * Leitet eine variable Ausgaben-Baseline je Kategorie aus der echten Historie
 * ab. Berücksichtigt nur *echte* Ausgaben: keine Transfers, keine als Vertrag
 * markierten Buchungen (die laufen als wiederkehrende Flows).
 *
 * Reine Funktion (kein IO) – damit unabhängig testbar.
 *
 * @param transactions Historische Transaktionen.
 * @param options.monthsBack Rückblickfenster in Monaten (Default 6).
 * @param options.now Referenzdatum (Default: jetzt).
 */
export function buildVariableExpenseBaselines(
  transactions: Transaction[],
  options: {
    monthsBack?: number;
    now?: Date;
    excludedFingerprints?: ReadonlySet<string>;
    categoryNames?: ReadonlyMap<string, string>;
  } = {},
): VariableExpenseBaseline[] {
  const monthsBack = options.monthsBack ?? 6;
  const now = options.now ?? new Date();
  const windowStart = startOfMonth(subMonths(now, Math.max(0, monthsBack - 1)));

  // Pro Kategorie die Ausgaben je Monat sammeln – Basis für Mittelwert *und*
  // Streuung (Variationskoeffizient).
  const perCategoryMonth = new Map<string, Map<string, number>>();
  let earliestIncludedMonth: string | null = null;

  for (const t of transactions) {
    if (t.is_transfer || t.is_contract) continue;
    if (options.excludedFingerprints?.has(merchantFingerprint(t))) continue;
    if (t.amount >= 0) continue; // nur Ausgaben
    const date = new Date(t.date);
    if (Number.isNaN(date.getTime())) continue;
    if (date < windowStart || date > now) continue;

    const category =
      t.category?.trim() ||
      (t.category_id ? options.categoryNames?.get(t.category_id) : undefined) ||
      'Sonstiges';
    const month = t.date.slice(0, 7);
    if (!earliestIncludedMonth || month < earliestIncludedMonth) earliestIncludedMonth = month;
    let byMonth = perCategoryMonth.get(category);
    if (!byMonth) {
      byMonth = new Map<string, number>();
      perCategoryMonth.set(category, byMonth);
    }
    byMonth.set(month, (byMonth.get(month) ?? 0) + Math.abs(t.amount));
  }

  const firstMonth = earliestIncludedMonth
    ? startOfMonth(new Date(`${earliestIncludedMonth}-01T12:00:00`))
    : startOfMonth(now);
  const lastMonth = startOfMonth(now);
  const monthKeys: string[] = [];
  for (let month = firstMonth; month <= lastMonth; month = addMonths(month, 1)) {
    monthKeys.push(format(month, 'yyyy-MM'));
  }
  const denom = Math.max(monthKeys.length, 1);
  const confidence = monthKeys.length >= 6 ? 0.9 : monthKeys.length >= 3 ? 0.75 : 0.5;

  // Wochentags-Tagesprofile je Kategorie (PR 2) – aus derselben Historie
  // abgeleitet, damit die Tagesverteilung das reale Muster widerspiegelt.
  const dailyProfiles = buildDailySpendingProfile(transactions, {
    now,
    excludedFingerprints: options.excludedFingerprints,
    categoryNames: options.categoryNames,
  });
  // Occurrence-Amount-Modelle je Kategorie (PR 3) – speisen die spiky
  // Monte-Carlo-Pfade (nur bei occurrenceSampling wirksam).
  const occurrenceModels = buildOccurrenceModel(transactions, {
    now,
    excludedFingerprints: options.excludedFingerprints,
    categoryNames: options.categoryNames,
  });

  const baselines: VariableExpenseBaseline[] = [];
  for (const [category, byMonth] of perCategoryMonth) {
    // Eine wiederkehrende Ausgaben-Baseline braucht mindestens zwei Monate mit
    // Ausgaben in dieser Kategorie. Aus einer einzelnen Buchung – etwa einer
    // einmaligen Großanschaffung oder einer Fehleingabe im laufenden Monat –
    // lässt sich kein monatliches Muster ableiten. Andernfalls würde sie als
    // Dauerlast über den gesamten Horizont projiziert und ein Phantom-
    // Liquiditätsrisiko erzeugen (Einnahmen sind einmalig, eine einzelne Ausgabe
    // muss es ebenso sein).
    if (byMonth.size < 2) continue;
    // Vektor über alle beobachteten Monate (0, wo nichts ausgegeben wurde).
    const values = monthKeys.map((mk) => byMonth.get(mk) ?? 0);
    const mean = values.reduce((s, v) => s + v, 0) / denom;
    const monthlyAmount = Math.round(mean * 100) / 100;
    if (monthlyAmount <= 0) continue;

    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / denom;
    const volatility = mean > 0 ? Math.round((Math.sqrt(variance) / mean) * 100) / 100 : 0;

    baselines.push({
      category,
      monthlyAmount,
      confidence,
      volatility,
      dailyProfile: dailyProfiles.get(category),
      occurrenceModel: occurrenceModels.get(category),
    });
  }
  // Größte Kategorien zuerst – stabil und gut für die UI.
  baselines.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
  return baselines;
}

/**
 * Wendet die nutzerseitigen Planungs-Overrides auf den auto-seeded Input an:
 * Tagesgeld-Zinssätze, Budget-Overrides je Kategorie, geplante Einmalposten,
 * Rücklagen und Transfers. Reine Funktion (kein IO) – damit unabhängig testbar.
 */
export function applyForecastOverrides(
  input: ForecastInput,
  overrides: ForecastOverrides,
): ForecastInput {
  const accounts = input.accounts.map((a) =>
    overrides.accountInterest[a.id] != null
      ? { ...a, annualInterestRate: overrides.accountInterest[a.id] }
      : a,
  );

  const variableExpenses = (input.variableExpenses ?? []).map((b) =>
    overrides.categoryBudgets[b.category] != null
      ? { ...b, budgetOverride: overrides.categoryBudgets[b.category] }
      : b,
  );

  return {
    ...input,
    accounts,
    variableExpenses,
    plannedEvents: [...(input.plannedEvents ?? []), ...overrides.plannedEvents],
    sinkingFunds: [...(input.sinkingFunds ?? []), ...overrides.sinkingFunds],
    transfers: [...(input.transfers ?? []), ...overrides.transfers],
  };
}

/** Bereits geladene Quellen für die reine Forecast-Komposition (kein IO). */
export interface ForecastInputSources {
  accounts: Account[];
  accountBalances: Record<string, number>;
  categories: Category[];
  decisions: Map<string, ContractDecision>;
  transactions: Transaction[];
  overrides: ForecastOverrides;
  /** Referenzdatum für Erkennung & Baseline (Default: jetzt). */
  now?: Date;
}

/**
 * Reine Komposition der Forecast-Eingaben aus bereits geladenen Quellen –
 * ohne IO und damit vollständig testbar. Hier entsteht das Auto-Seeding:
 *  - Einnahmen: erkannte Gehaltsserien (arbeitgeber-basiert) UND regelmäßige
 *    Einnahmen-Verträge (IBAN-/händlerbasiert) fließen als positive Flows ein.
 *  - Ausgaben: bestätigte Verträge als Fixkosten, der Rest als variable Baseline.
 *
 * {@link buildForecastInput} beschafft die Quellen und delegiert hierher, damit
 * die gesamte Logik – insbesondere ob regelmäßiges Einkommen berücksichtigt
 * wird – ohne Service-Mocks geprüft werden kann.
 */
export function composeForecastInput(sources: ForecastInputSources): ForecastInput {
  const { accounts, accountBalances, categories, decisions, transactions, overrides, now } = sources;
  const forecastAccounts = buildForecastAccounts(accounts, accountBalances);
  const categoryMap = new Map<string, Category>(categories.map((category) => [category.id, category]));
  const contracts = [
    ...computeContracts(transactions, categoryMap, 'Einnahme', { decisions, now }),
    ...computeContracts(transactions, categoryMap, 'Ausgabe', { decisions, now }),
  ];
  const salaryFlows = buildDetectedSalaryFlows(
    transactions,
    overrides.recurringFlowOverrides,
    now,
  );
  const salaryEmployers = new Set(salaryFlows.map((flow) => normalizeMerchantName(flow.name)));
  const otherRecurringFlows = buildRecurringFlows(
    contracts,
    overrides.recurringFlowOverrides,
  ).filter((flow) => flow.amount < 0 || !salaryEmployers.has(normalizeMerchantName(flow.name)));
  const recurringFlows = bindFlowsToDefaultAccount(
    [...salaryFlows, ...otherRecurringFlows],
    forecastAccounts,
  );
  // Erkannte Vertragsfamilien, die explizit beendet/abgelehnt/pausiert/archiviert
  // wurden, sind keine zukünftigen variablen Ausgaben. Kandidaten bleiben bis
  // zur Bestätigung in der Baseline und werden nicht zugleich als Fixkosten geplant.
  const excludedFingerprints = new Set(
    contracts
      .filter((contract) => contract.status !== 'candidate')
      .map((contract) => contract.fingerprint),
  );
  const variableExpenses = buildVariableExpenseBaselines(transactions, {
    now,
    excludedFingerprints,
    categoryNames: new Map(categories.map((category) => [category.id, category.name])),
  });

  // Alle Vertrags-Flows für die UI (inkl. beendete/pausierte mit disabled-Flag).
  // Gehalts-Flows werden vorangestellt und danach die Vertragsflows ohne Gehalt.
  const allContractFlows = buildAllContractFlowsForDisplay(
    contracts,
    overrides.recurringFlowOverrides,
  ).filter((flow) => flow.amount < 0 || !salaryEmployers.has(normalizeMerchantName(flow.name)));
  const allRecurringFlows = bindFlowsToDefaultAccount(
    [...salaryFlows, ...allContractFlows],
    forecastAccounts,
  );

  const seeded: ForecastInput = {
    accounts: forecastAccounts,
    recurringFlows,
    allRecurringFlows,
    variableExpenses,
  };

  return applyForecastOverrides(seeded, overrides);
}

/**
 * Sammelt alle Eingaben für die Forecast-Engine aus den echten Services und
 * legt die nutzerseitigen Planungs-Overrides darüber. Reines IO – die Logik
 * liegt in {@link composeForecastInput}.
 */
export async function buildForecastInput(): Promise<ForecastInput> {
  const [accounts, netWorth, categories, decisions, transactions] = await Promise.all([
    getAccounts(),
    getNetWorthBreakdown(),
    getCategories(),
    getContractDecisionMap(),
    getTransactions(10000),
  ]);

  return composeForecastInput({
    accounts,
    accountBalances: netWorth.accountBalances,
    categories,
    decisions,
    transactions,
    overrides: getForecastOverrides(),
  });
}
