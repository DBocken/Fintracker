import type { EtoroHistoricalBalancesResponse, EtoroBalancesResponse } from './etoro-api-schemas';

// -----------------------------------------------------------------------------
// Performance (eToro Kontostand-Verlauf) — reine Selektor-Funktionen über die
// Antworten aus etoro-api-schemas.ts. Keine Netzwerk-/Persistenz-Logik hier,
// nur Ableitung fürs UI (Performance-Tab), analog etoro-mirrors.ts.
// -----------------------------------------------------------------------------

export interface PerformancePoint {
  /** ISO-Datum (YYYY-MM-DD) des Snapshots. */
  date: string;
  value: number;
}

/**
 * Bildet die täglichen Kontostand-Snapshots auf Chart-Datenpunkte ab,
 * chronologisch aufsteigend sortiert (eToro liefert die Reihenfolge nicht
 * garantiert). displayTotalBalance bevorzugt (bereits in der angefragten
 * Anzeigewährung), totalBalance als Fallback.
 */
export function selectPerformanceSeries(history: EtoroHistoricalBalancesResponse | undefined): PerformancePoint[] {
  const snapshots = history?.snapshots ?? [];

  return [...snapshots]
    .map((snapshot) => ({
      date: snapshot.date,
      value: snapshot.displayTotalBalance ?? snapshot.totalBalance ?? 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type PerformanceTrend = 'positive' | 'warning' | 'neutral';

/**
 * Schwellwert-Einordnung für die Chart-Farbe (Animations-Baseline: Farbe
 * datengetrieben, nicht statisch): Vergleich des letzten mit dem ersten
 * Datenpunkt der Serie.
 */
export function selectPerformanceTrend(series: PerformancePoint[]): PerformanceTrend {
  if (series.length < 2) return 'neutral';
  const delta = series[series.length - 1].value - series[0].value;
  if (delta > 0) return 'positive';
  if (delta < 0) return 'warning';
  return 'neutral';
}

/**
 * Löst die Cash-Account-ID aus den aggregierten Kontoständen auf — wird von
 * fetchEtoroCashTransactions als Pfad-Parameter benötigt (die Portfolio-/
 * Aggregate-Antworten kennen sie nicht). Liefert undefined, wenn kein
 * Cash-Konto vorhanden ist (z. B. reines Trading-only-Konto).
 */
export function selectCashAccountId(balances: EtoroBalancesResponse | undefined): string | undefined {
  const cashAccount = (balances?.balances ?? []).find((account) => account.accountType === 'Cash');
  return cashAccount?.accountId ?? undefined;
}
