/**
 * FinRisk – Lumpy-Risiko aus der Historie (v27)
 *
 * Klassisches Budgeting fragt „wofür?“. Die Risikoanalyse fragt: „Welche seltenen,
 * größeren Ausgaben gefährden die Liquidität?“. Dieses Modul leitet aus der
 * Transaktionshistorie eine Frequency-Severity-Sicht ab:
 *  - wie häufig pro Jahr treten Lumpy-Events auf (`lumpyRateAnnual`),
 *  - wie schwer sind sie (Severity P50/P75/P90),
 *  - welche Kategorien treiben das Risiko,
 *  - und ein grobes Risikolevel.
 *
 * „Lumpy“ = variable Ausgabe (keine Transfers, keine Verträge) oberhalb einer
 * robusten Schwelle. Die Ausschlusslogik entspricht `buildVariableExpenseBaselines`
 * (`forecast-data.ts`), damit Alltag und Verträge konsistent ausgeklammert sind.
 */
import { percentile } from '../forecast-montecarlo';
import type { Transaction } from '@/types';

export type LumpyRiskLevel = 'low' | 'medium' | 'high';

export interface LumpyCategoryHint {
  category: string;
  count: number;
  total: number;
}

export interface LumpyRiskProfile {
  /** Anzahl erkannter Lumpy-Events. */
  lumpyCount: number;
  /** Hochgerechnete Jahreshäufigkeit. */
  lumpyRateAnnual: number;
  /** Severity-Quantile (EUR). */
  lumpySeverityP50: number;
  lumpySeverityP75: number;
  lumpySeverityP90: number;
  /** Schwelle, ab der eine Ausgabe als Lumpy zählt (EUR). */
  thresholdAmount: number;
  /** Stärkste Kategorien (nach Summe), absteigend. */
  topCategories: LumpyCategoryHint[];
  /** Grobe Einstufung. */
  lumpyRiskLevel: LumpyRiskLevel;
}

export interface LumpyRiskOptions {
  /** Multiplikator auf den Median der variablen Ausgaben (Default 3). */
  medianMultiplier?: number;
  /** Absolute Mindestschwelle in EUR, damit Kleinbeträge nie als Lumpy zählen. */
  absoluteFloor?: number;
  /** Fester Schwellenwert; überschreibt die abgeleitete Schwelle, falls gesetzt. */
  thresholdOverride?: number;
  excludedFingerprints?: ReadonlySet<string>;
}

function median(sorted: number[]): number {
  return percentile(sorted, 50);
}

function categoryOf(t: Transaction): string {
  return t.category?.trim() || 'Sonstiges';
}

/**
 * Leitet das Lumpy-Risikoprofil aus der Historie ab.
 *
 * @param transactions Vollständige Transaktionshistorie.
 * @param options      Schwellen-/Ausschluss-Parameter.
 */
export function buildLumpyRiskProfile(
  transactions: Transaction[],
  options: LumpyRiskOptions = {},
): LumpyRiskProfile {
  const medianMultiplier = options.medianMultiplier ?? 3;
  const absoluteFloor = options.absoluteFloor ?? 0;

  // Variable Ausgaben isolieren (Transfers/Verträge raus, nur Abflüsse).
  const spends: Array<{ amount: number; category: string; date: string }> = [];
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (const t of transactions) {
    if (t.is_transfer || t.is_contract) continue;
    if (t.amount >= 0) continue;
    if (Number.isNaN(new Date(t.date).getTime())) continue;
    const amount = Math.abs(t.amount);
    spends.push({ amount, category: categoryOf(t), date: t.date });
    if (!minDate || t.date < minDate) minDate = t.date;
    if (!maxDate || t.date > maxDate) maxDate = t.date;
  }

  const emptyProfile: LumpyRiskProfile = {
    lumpyCount: 0,
    lumpyRateAnnual: 0,
    lumpySeverityP50: 0,
    lumpySeverityP75: 0,
    lumpySeverityP90: 0,
    thresholdAmount: options.thresholdOverride ?? absoluteFloor,
    topCategories: [],
    lumpyRiskLevel: 'low',
  };

  if (spends.length === 0) return emptyProfile;

  const sortedAmounts = spends.map((s) => s.amount).sort((a, b) => a - b);
  const threshold =
    options.thresholdOverride ?? Math.max(absoluteFloor, medianMultiplier * median(sortedAmounts));

  const lumpy = spends.filter((s) => s.amount >= threshold && s.amount > 0);
  if (lumpy.length === 0) return { ...emptyProfile, thresholdAmount: threshold };

  // Beobachtungszeitraum in Jahren (Untergrenze 1 Monat, damit keine Division
  // durch ~0 die Jahresrate explodieren lässt).
  const spanDays =
    minDate && maxDate
      ? (new Date(maxDate).getTime() - new Date(minDate).getTime()) / (1000 * 60 * 60 * 24)
      : 0;
  const years = Math.max(spanDays / 365.25, 1 / 12);

  const lumpyAmounts = lumpy.map((l) => l.amount).sort((a, b) => a - b);
  const lumpyRateAnnual = lumpy.length / years;

  // Kategorien nach Summe.
  const byCategory = new Map<string, { count: number; total: number }>();
  for (const l of lumpy) {
    const entry = byCategory.get(l.category) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += l.amount;
    byCategory.set(l.category, entry);
  }
  const topCategories: LumpyCategoryHint[] = [...byCategory.entries()]
    .map(([category, v]) => ({ category, count: v.count, total: Math.round(v.total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const round2 = (v: number) => Math.round(v * 100) / 100;
  const severityP50 = round2(percentile(lumpyAmounts, 50));
  const severityP90 = round2(percentile(lumpyAmounts, 90));

  // Grobe Einstufung über die erwartete Jahres-Lumpy-Last (Rate × Median-Severity).
  const annualExpectedCost = lumpyRateAnnual * severityP50;
  let lumpyRiskLevel: LumpyRiskLevel = 'low';
  if (annualExpectedCost >= 3000 || severityP90 >= 2000) lumpyRiskLevel = 'high';
  else if (annualExpectedCost >= 800 || severityP90 >= 600) lumpyRiskLevel = 'medium';

  return {
    lumpyCount: lumpy.length,
    lumpyRateAnnual: round2(lumpyRateAnnual),
    lumpySeverityP50: severityP50,
    lumpySeverityP75: round2(percentile(lumpyAmounts, 75)),
    lumpySeverityP90: severityP90,
    thresholdAmount: round2(threshold),
    topCategories,
    lumpyRiskLevel,
  };
}
