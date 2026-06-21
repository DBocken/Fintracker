/**
 * Forecast Engine – Insight Layer (Stufe 1, §25 der Spezifikation)
 *
 * Reine Logik ohne IO. Beantwortet nicht nur *ob* die Liquidität knapp wird,
 * sondern **warum** (Risikotreiber) und **was konkret hilft** (Empfehlung).
 *
 * Die Treiber-Attribution betrachtet die *Drawdown-Phase*: vom letzten
 * Höchststand des verfügbaren Geldes bis zum Tiefststand. Alle Abflüsse in
 * diesem Fenster (Verträge, Einmalposten, variable Ausgaben) werden ihren
 * Quellen zugeordnet und nach Größe sortiert.
 */
import { differenceInCalendarMonths, parseISO } from 'date-fns';
import { listFlowOccurrences } from './forecast';
import type { ForecastInput, ForecastResult, RecurringFlow } from './forecast-types';

/** Ein einzelner Treiber des Liquiditätsrückgangs. */
export interface RiskDriver {
  name: string;
  /** Summe der Abflüsse in der Drawdown-Phase (positive Zahl). */
  amount: number;
  kind: 'recurring' | 'event' | 'variable';
  category?: string;
  /** Anzahl der Buchungen im Fenster (z. B. 1 Jahreszahlung, 2 Mieten). */
  occurrences?: number;
}

export type RecommendationKind =
  | 'transfer_from_reserve'
  | 'build_sinking_fund'
  | 'reduce_variable'
  | 'increase_buffer'
  | 'none';

/** Eine konkrete, umsetzbare Handlungsempfehlung. */
export interface ForecastRecommendation {
  kind: RecommendationKind;
  message: string;
  /** Empfohlener Betrag (z. B. Rücktransfer-Höhe), falls anwendbar. */
  amount?: number;
}

/** Ergebnis der Risikoanalyse. */
export interface RiskAnalysis {
  /** Datum, an dem die Drawdown-Phase beginnt (letzter Höchststand). */
  drawdownStart: string;
  /** Datum des Tiefststands. */
  troughDate: string;
  drivers: RiskDriver[];
  recommendation: ForecastRecommendation | null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Bestimmt die Drawdown-Phase: das Datum des höchsten maßgeblichen Saldos vor
 * (bzw. bis zu) dem Tiefststand. Davor wurde das Geld noch nicht abgebaut.
 */
function findDrawdownStart(result: ForecastResult): string {
  const { daily, risk, config } = result;
  const troughIdx = daily.findIndex((d) => d.date === risk.lowestBalanceDate);
  const end = troughIdx >= 0 ? troughIdx : daily.length - 1;
  const basisOf = (i: number) =>
    config.bufferBasis === 'available' ? daily[i].availableCash : daily[i].operatingCash;

  let peakIdx = 0;
  let peakValue = Number.NEGATIVE_INFINITY;
  for (let i = 0; i <= end; i++) {
    if (basisOf(i) >= peakValue) {
      peakValue = basisOf(i);
      peakIdx = i;
    }
  }
  return daily[peakIdx]?.date ?? config.startDate;
}

/**
 * Analysiert die Risikotreiber und leitet eine konkrete Empfehlung ab.
 *
 * @param input  Die ursprünglichen Forecast-Eingaben (für die Attribution).
 * @param result Das Ergebnis von `calculateDeterministicForecast`.
 */
export function analyzeRisk(input: ForecastInput, result: ForecastResult): RiskAnalysis {
  const { daily, risk } = result;
  const troughDate = risk.lowestBalanceDate;
  const drawdownStart = findDrawdownStart(result);

  // Fenster [drawdownStart, troughDate] – die Phase des Geldabbaus.
  const windowPoints = daily.filter((d) => d.date >= drawdownStart && d.date <= troughDate);

  const drivers: RiskDriver[] = [];

  // 1) Wiederkehrende Ausgaben (Verträge) im Fenster.
  for (const flow of input.recurringFlows ?? []) {
    if (flow.amount >= 0) continue; // nur Abflüsse
    const occ = listFlowOccurrences(flow as RecurringFlow, drawdownStart, troughDate);
    if (occ.length === 0) continue;
    drivers.push({
      name: flow.name,
      amount: round2(Math.abs(flow.amount) * occ.length),
      kind: 'recurring',
      category: flow.category,
      occurrences: occ.length,
    });
  }

  // 2) Geplante Einmalposten (Abflüsse) im Fenster.
  for (const event of input.plannedEvents ?? []) {
    if (event.amount >= 0) continue;
    if (event.date < drawdownStart || event.date > troughDate) continue;
    drivers.push({
      name: event.name,
      amount: round2(Math.abs(event.amount)),
      kind: 'event',
      category: event.category,
      occurrences: 1,
    });
  }

  // 3) Variable Ausgaben im Fenster (aggregiert).
  const variableTotal = round2(windowPoints.reduce((sum, p) => sum + p.variableExpenses, 0));
  if (variableTotal > 0) {
    drivers.push({ name: 'Variable Ausgaben', amount: variableTotal, kind: 'variable' });
  }

  drivers.sort((a, b) => b.amount - a.amount);
  const topDrivers = drivers.slice(0, 5);

  const recommendation = buildRecommendation(input, result, topDrivers);

  return { drawdownStart, troughDate, drivers: topDrivers, recommendation };
}

function buildRecommendation(
  input: ForecastInput,
  result: ForecastResult,
  drivers: RiskDriver[],
): ForecastRecommendation | null {
  const { daily, risk, config } = result;
  if (!risk.firstBelowSafetyBufferDate) return null;

  const troughPoint = daily.find((d) => d.date === risk.lowestBalanceDate);
  if (!troughPoint) return null;

  // Fehlbetrag bis zum Sicherheitspuffer auf der maßgeblichen Cash-Sicht.
  const basis = config.bufferBasis === 'available' ? troughPoint.availableCash : troughPoint.operatingCash;
  const shortfall = round2(config.safetyBuffer - basis);
  if (shortfall <= 0) return null;

  // (a) Reserve außerhalb des Giros vorhanden? -> Rücktransfer empfehlen.
  const reserve = round2(troughPoint.availableCash - troughPoint.operatingCash);
  if (config.bufferBasis === 'operating' && reserve > 0) {
    const transfer = Math.min(reserve, shortfall);
    return {
      kind: 'transfer_from_reserve',
      amount: round2(transfer),
      message:
        `Ein Rücktransfer von ${round2(transfer)} € von deiner Reserve (z. B. Tagesgeld) ` +
        `auf dein Giro würde den Tiefststand am ${risk.lowestBalanceDate} über den ` +
        `Sicherheitspuffer (${config.safetyBuffer} €) heben.`,
    };
  }

  // (b) Dominierender, selten-großer Vertrag -> Rücklage (Sinking Fund).
  const bigFlow = findLumpyDriver(input, drivers);
  if (bigFlow) {
    const monthsUntil = Math.max(
      1,
      differenceInCalendarMonths(parseISO(risk.lowestBalanceDate), parseISO(config.startDate)) || 1,
    );
    const monthly = round2(bigFlow.amount / monthsUntil);
    return {
      kind: 'build_sinking_fund',
      amount: monthly,
      message:
        `„${bigFlow.name}“ (${bigFlow.amount} €) treibt das Risiko. Lege ab jetzt ` +
        `monatlich ~${monthly} € zurück, um die Zahlung abzufedern, statt sie in einem ` +
        `Monat zu stemmen.`,
    };
  }

  // (c) Variable Ausgaben sind der größte Treiber -> Budget senken.
  if (drivers[0]?.kind === 'variable') {
    return {
      kind: 'reduce_variable',
      amount: round2(shortfall),
      message:
        `Variable Ausgaben sind dein größter Treiber. Ein Budget, das sie um ` +
        `${round2(shortfall)} € senkt, würde den Pufferbruch vermeiden.`,
    };
  }

  // (d) Fallback: Puffer ist knapp bemessen.
  return {
    kind: 'increase_buffer',
    amount: round2(shortfall),
    message:
      `Dir fehlen am Tiefpunkt ${round2(shortfall)} € zum Sicherheitspuffer. ` +
      `Erhöhe deinen Giro-Bestand frühzeitig oder verschiebe größere Ausgaben.`,
  };
}

/**
 * Findet einen „klumpigen“ Treiber: eine einzelne, seltene, aber große Zahlung
 * (Jahres-/Quartals-/Halbjahresvertrag), die sich für eine Rücklage eignet.
 */
function findLumpyDriver(input: ForecastInput, drivers: RiskDriver[]): RiskDriver | null {
  const lumpyCadences = new Set(['quarterly', 'semiannual', 'annual']);
  const lumpyNames = new Set(
    (input.recurringFlows ?? [])
      .filter((f) => lumpyCadences.has(f.cadence))
      .map((f) => f.name),
  );
  return (
    drivers.find((d) => d.kind === 'recurring' && lumpyNames.has(d.name) && d.amount >= 300) ?? null
  );
}
