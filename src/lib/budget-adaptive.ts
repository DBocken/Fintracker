import type { Budget, Category, Transaction, TransactionAllocation } from "@/types";
import { computeBudgetSpent, roundSuggestion } from "@/lib/budget-logic";

/** Median einer Zahlenliste (robust gegen Ausreißer). Leere Liste → 0. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Liefert die `count` Monate vor `period` (`YYYY-MM`), chronologisch (ältester zuerst). */
export function trailingMonths(period: string, count: number): string[] {
  const [yStr, mStr] = period.split("-");
  let year = Number(yStr);
  let month = Number(mStr); // 1..12
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    result.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return result.reverse();
}

/** Schneidet führende Nullen ab (Monate vor der ersten echten Ausgabe = Vor-Historie). */
function trimLeadingZeros(values: number[]): number[] {
  const firstNonZero = values.findIndex((v) => v > 0);
  return firstNonZero === -1 ? [] : values.slice(firstNonZero);
}

function monthSpendSeries(
  budget: Budget,
  transactions: Transaction[],
  categories: Category[],
  months: string[],
  allocationsByTx?: Map<string, TransactionAllocation[]>,
): number[] {
  return months.map((m) => computeBudgetSpent(budget, transactions, categories, m, allocationsByTx));
}

export interface AdaptiveOptions {
  /** Fenstergröße in Monaten für den Median (Default 6). */
  windowMonths?: number;
  /** Auf 10er-Stufe runden (mit Puffer, via roundSuggestion). Default true. */
  round?: boolean;
}

/**
 * Erzeugt eine `baseLimitFor`-Funktion für die Rollover-Engine: Das Basislimit
 * jeder Periode ist der Median der Ausgaben im vorausgehenden Fenster (robust
 * gegen einzelne Ausreißer). Vor-Historie (führende Nullmonate) wird ignoriert;
 * ohne jede Historie fällt der Wert auf `budget.limit` zurück.
 */
export function buildAdaptiveBaseLimit(
  budget: Budget,
  transactions: Transaction[],
  categories: Category[],
  options?: AdaptiveOptions,
  allocationsByTx?: Map<string, TransactionAllocation[]>,
): (period: string) => number {
  const window = options?.windowMonths ?? 6;
  const round = options?.round ?? true;

  return (period: string) => {
    const series = monthSpendSeries(budget, transactions, categories, trailingMonths(period, window), allocationsByTx);
    const data = trimLeadingZeros(series);
    if (data.length === 0) return budget.limit;
    const med = median(data);
    return round ? roundSuggestion(med) : med;
  };
}

export interface AdaptiveBaselineOptions extends AdaptiveOptions {
  /** Bezugsmonat `YYYY-MM`, ab dem rückwärts betrachtet wird. */
  currentMonth: string;
  /** Zielmonat, für den das Limit gilt (Default: Monat nach `currentMonth`). */
  targetMonth?: string;
  /** Mindesthistorie (Monate), ab der ein Tank nicht mehr als „lernend" gilt (Default 3). */
  minMonths?: number;
  /** Saisonfaktor anwenden (Default true). */
  seasonality?: boolean;
  /** Mindesthistorie (Monate) für die Saison-Schätzung (Default 12). */
  minMonthsForSeason?: number;
}

export interface AdaptiveBaseline {
  /** Empfohlenes Basislimit (nach Saison & Rundung). */
  baseLimit: number;
  /** Robuster Median der Fenster-Ausgaben (vor Saison/Rundung). */
  median: number;
  /** Angewandter Saisonfaktor (1 = neutral). */
  seasonalFactor: number;
  /** Anzahl Monate mit echter Datenbasis im Fenster. */
  monthsOfData: number;
  /** true, wenn die Datenbasis unter `minMonths` liegt (Tank „lernt" noch). */
  learning: boolean;
}

const SEASON_LOOKBACK = 36;
const SEASON_MIN = 0.5;
const SEASON_MAX = 2;

function nextMonth(period: string): string {
  const [yStr, mStr] = period.split("-");
  let year = Number(yStr);
  let month = Number(mStr) + 1;
  if (month === 13) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Schätzt einen Saisonfaktor für den Kalendermonat von `targetMonth`: das
 * Verhältnis der durchschnittlichen Ausgaben dieses Kalendermonats zum
 * Gesamtdurchschnitt der aktiven Historie. Neutral (1), wenn die Historie zu
 * dünn ist oder zu wenige Vergleichsmonate vorliegen. Auf [0,5 .. 2] begrenzt.
 */
function computeSeasonalFactor(
  budget: Budget,
  transactions: Transaction[],
  categories: Category[],
  targetMonth: string,
  minMonthsForSeason: number,
  allocationsByTx?: Map<string, TransactionAllocation[]>,
): number {
  const targetCal = Number(targetMonth.split("-")[1]);
  const months = trailingMonths(targetMonth, SEASON_LOOKBACK);
  const series = monthSpendSeries(budget, transactions, categories, months, allocationsByTx);

  // Vor-Historie abschneiden, dann Monate + Werte synchron halten.
  const firstNonZero = series.findIndex((v) => v > 0);
  if (firstNonZero === -1) return 1;
  const activeMonths = months.slice(firstNonZero);
  const activeSpends = series.slice(firstNonZero);
  if (activeSpends.length < minMonthsForSeason) return 1;

  const overallAvg = activeSpends.reduce((s, v) => s + v, 0) / activeSpends.length;
  if (overallAvg <= 0) return 1;

  const sameMonthSpends = activeMonths
    .map((m, i) => ({ cal: Number(m.split("-")[1]), spend: activeSpends[i] }))
    .filter((e) => e.cal === targetCal)
    .map((e) => e.spend);
  if (sameMonthSpends.length < 2) return 1; // zu wenige Saison-Stichproben

  const seasonAvg = sameMonthSpends.reduce((s, v) => s + v, 0) / sameMonthSpends.length;
  const factor = seasonAvg / overallAvg;
  return Math.min(SEASON_MAX, Math.max(SEASON_MIN, factor));
}

/**
 * Berechnet ein datengetriebenes Basislimit für `targetMonth` inklusive
 * Metadaten (Median, Saisonfaktor, Konfidenz). Grundlage für Vorschläge und
 * die UI-Anzeige „lernender" Tanks.
 */
export function computeAdaptiveBaseline(
  budget: Budget,
  transactions: Transaction[],
  categories: Category[],
  options: AdaptiveBaselineOptions,
  allocationsByTx?: Map<string, TransactionAllocation[]>,
): AdaptiveBaseline {
  const window = options.windowMonths ?? 6;
  const minMonths = options.minMonths ?? 3;
  const round = options.round ?? true;
  const target = options.targetMonth ?? nextMonth(options.currentMonth);

  const series = monthSpendSeries(budget, transactions, categories, trailingMonths(target, window), allocationsByTx);
  const data = trimLeadingZeros(series);
  const med = median(data);

  const seasonalFactor =
    (options.seasonality ?? true)
      ? computeSeasonalFactor(budget, transactions, categories, target, options.minMonthsForSeason ?? 12, allocationsByTx)
      : 1;

  const raw = med * seasonalFactor;
  return {
    baseLimit: round ? roundSuggestion(raw) : raw,
    median: med,
    seasonalFactor,
    monthsOfData: data.length,
    learning: data.length < minMonths,
  };
}
