/**
 * Forecast Engine – Monte-Carlo-Typen (Stufe 4: Unsicherheit & Bandbreiten)
 *
 * Die deterministische Projektion beantwortet „was passiert bei genau diesen
 * Annahmen". Die Realität streut: variable Ausgaben schwanken Monat für Monat,
 * Einnahmen sind nicht immer fix. Monte Carlo rechnet viele Durchläufe mit
 * zufällig variierten – aber aus der Historie kalibrierten – Eingaben und
 * verdichtet sie zu Wahrscheinlichkeiten und Bandbreiten (P10/P50/P90).
 *
 * Grundsatz wie überall: der Engine-Kern bleibt unberührt. Jeder Durchlauf ist
 * eine zufällig perturbierte {@link ForecastInput}, die durch dieselbe pure
 * Engine läuft. Mit festem Seed ist das Ergebnis reproduzierbar.
 */
import type { ResolvedForecastConfig } from './forecast-types';

/** Konfiguration eines Monte-Carlo-Laufs. */
export interface MonteCarloConfig {
  /** Anzahl der Durchläufe. Default 500. */
  trials?: number;
  /** Seed für den PRNG (Reproduzierbarkeit). Default 1. */
  seed?: number;
  /**
   * Überschreibt den aus der Historie abgeleiteten Variationskoeffizienten der
   * variablen Ausgaben. Ohne Angabe gilt je Kategorie deren `volatility`.
   */
  variableVolatility?: number;
  /** Variationskoeffizient der Einnahmen (wiederkehrende Zuflüsse). Default 0. */
  incomeVolatility?: number;
}

/** Aufgelöste Konfiguration (alle Defaults gesetzt). */
export interface ResolvedMonteCarloConfig {
  trials: number;
  seed: number;
  variableVolatility: number | null;
  incomeVolatility: number;
}

/** Ein Tagespunkt der Wahrscheinlichkeits-Bandbreite (maßgebliche Cash-Sicht). */
export interface MonteCarloBandPoint {
  date: string;
  /** 10. Perzentil – pessimistischer Pfad. */
  p10: number;
  /** Median. */
  p50: number;
  /** 90. Perzentil – optimistischer Pfad. */
  p90: number;
}

/** Verteilungs-Kennzahlen einer Größe über alle Durchläufe. */
export interface MonteCarloDistribution {
  p10: number;
  p50: number;
  p90: number;
  mean: number;
}

/** Ergebnis eines Monte-Carlo-Laufs. */
export interface MonteCarloResult {
  config: ResolvedForecastConfig;
  monteCarlo: ResolvedMonteCarloConfig;
  /** Tagesgenaue P10/P50/P90-Bandbreite der maßgeblichen Cash-Sicht. */
  band: MonteCarloBandPoint[];
  /** Anteil der Durchläufe, die irgendwann unter den Sicherheitspuffer fallen (0..1). */
  breachProbability: number;
  /** Verteilung des Tiefststands über die Durchläufe. */
  lowestBalance: MonteCarloDistribution;
  /** Verteilung des Endvermögens (Net Worth) über die Durchläufe. */
  endingNetWorth: MonteCarloDistribution;
}
