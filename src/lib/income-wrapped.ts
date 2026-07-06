/**
 * „Income Wrapped" — Jahresrückblick-Statistiken über die Einkommensströme.
 * Reine Aggregation auf Basis der bestehenden Bausteine (`deriveIncomeStreams`,
 * `buildIncomeOverTime`, `buildShareCardData`) — keine neue Kernlogik.
 */
import type { Category, Transaction } from "@/types";
import { deriveIncomeStreams, type IncomeStreamsResult } from "./income-streams";
import { buildIncomeOverTime } from "./analysis-data";
import { buildShareCardData, type ShareCardData } from "./share-card";

export interface WrappedStats {
  year: number;
  /** true, wenn das Jahr noch läuft (Year-to-date). */
  partialYear: boolean;
  totalIncome: number;
  transactionCount: number;
  bestMonth: { month: string; total: number } | null;
  /** Am schnellsten gewachsen (2. vs. 1. Jahreshälfte). */
  fastestGrowingStream: { key: string; label: string; growthPercent: number } | null;
  /** Treuester/regelmäßigster Strom (meiste aktive Monate). */
  mostRegularStream: { key: string; label: string; monthsActive: number; transactionCount: number } | null;
  streamCount: number;
  largestShare: number;
  diversification: IncomeStreamsResult["diversification"];
  shareCard: ShareCardData;
}

function yearOf(t: Transaction): number | null {
  const y = Number(t.date.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function hasIncomeInYear(transactions: Transaction[], categories: Category[], year: number, now: Date): boolean {
  const stats = buildWrappedStats(transactions, categories, year, { now });
  return stats !== null && stats.totalIncome > 0;
}

/**
 * Wählt das Jahr für den Rückblick: Vorjahr, wenn es Einnahmen hat; sonst das
 * laufende Jahr, wenn es Einnahmen hat; sonst `null`.
 */
export function pickWrappedYear(
  transactions: Transaction[],
  categories: Category[],
  now: Date = new Date(),
): number | null {
  const currentYear = now.getFullYear();
  const previousYear = currentYear - 1;
  if (hasIncomeInYear(transactions, categories, previousYear, now)) return previousYear;
  if (hasIncomeInYear(transactions, categories, currentYear, now)) return currentYear;
  return null;
}

/**
 * Baut die Wrapped-Statistiken für ein Kalenderjahr. `null`, wenn das Jahr keine
 * Einnahmen enthält. Nachbarjahr-Buchungen fließen bewusst nicht ein.
 */
export function buildWrappedStats(
  transactions: Transaction[],
  categories: Category[],
  year: number,
  options?: { now?: Date },
): WrappedStats | null {
  const now = options?.now ?? new Date();
  const nowISO = now.toISOString().slice(0, 10);

  const yearTxs = transactions.filter((t) => yearOf(t) === year && t.date.slice(0, 10) <= nowISO);
  if (yearTxs.length === 0) return null;

  // Fenster großzügig auf 13 Monate, damit das ganze Jahr abgedeckt ist; da wir
  // schon aufs Jahr gefiltert haben, begrenzt das Datum die Menge.
  const result = deriveIncomeStreams(yearTxs, categories, {
    now: new Date(`${year}-12-31T12:00:00Z`) < now ? new Date(`${year}-12-31T12:00:00Z`) : now,
    windowMonths: 13,
  });

  if (result.totalIncome <= 0) return null;

  const overTime = buildIncomeOverTime(yearTxs, categories);
  const bestMonthPoint = overTime.reduce<{ month: string; total: number } | null>(
    (best, p) => (best === null || p.total > best.total ? { month: p.month, total: p.total } : best),
    null,
  );

  const partialYear = year === now.getFullYear();

  // Am schnellsten gewachsen: 2. Halbjahr vs. 1. Halbjahr aus monthlyTotals.
  let fastestGrowingStream: WrappedStats["fastestGrowingStream"] = null;
  for (const s of result.streams) {
    if (s.monthsActive < 4) continue;
    let firstHalf = 0;
    let secondHalf = 0;
    for (const [month, value] of Object.entries(s.monthlyTotals)) {
      const m = Number(month.slice(5, 7));
      if (m <= 6) firstHalf += value;
      else secondHalf += value;
    }
    if (firstHalf <= 0) continue;
    const growthPercent = ((secondHalf - firstHalf) / firstHalf) * 100;
    if (growthPercent > 10 && (fastestGrowingStream === null || growthPercent > fastestGrowingStream.growthPercent)) {
      fastestGrowingStream = { key: s.key, label: s.label, growthPercent: Math.round(growthPercent) };
    }
  }

  // Treuester Strom: regelmäßig, meiste aktive Monate (Tiebreak: Transaktionen).
  let mostRegularStream: WrappedStats["mostRegularStream"] = null;
  for (const s of result.streams) {
    if (s.cadence !== "regelmaessig") continue;
    if (
      mostRegularStream === null ||
      s.monthsActive > mostRegularStream.monthsActive ||
      (s.monthsActive === mostRegularStream.monthsActive && s.transactionCount > mostRegularStream.transactionCount)
    ) {
      mostRegularStream = {
        key: s.key,
        label: s.label,
        monthsActive: s.monthsActive,
        transactionCount: s.transactionCount,
      };
    }
  }

  const incomeTxCount = result.streams.reduce((sum, s) => sum + s.transactionCount, 0);

  return {
    year,
    partialYear,
    totalIncome: result.totalIncome,
    transactionCount: incomeTxCount,
    bestMonth: bestMonthPoint,
    fastestGrowingStream,
    mostRegularStream,
    streamCount: result.streams.length,
    largestShare: result.largestShare,
    diversification: result.diversification,
    shareCard: buildShareCardData(result),
  };
}
