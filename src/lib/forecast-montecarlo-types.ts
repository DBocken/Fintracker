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
  /**
   * Sammelt die einzelnen Trial-Pfade (pfad-major: `paths[trial][tag]`) und gibt
   * sie in {@link MonteCarloResult.paths} zurück. Default `false` – nur aktivieren,
   * wenn die Pfade weiterverarbeitet werden (z. B. Stress-Capacity, Breach-Kurven),
   * da der Speicherbedarf mit `trials × Tagen` wächst.
   */
  collectPaths?: boolean;
  /**
   * Zieht variable Ausgaben pro Trial als spiky Ereignisse aus dem
   * Occurrence-Amount-Modell (PR 3), statt sie geglättet über den Monat zu
   * verteilen. Nur Baselines mit `occurrenceModel` sind betroffen; alle anderen
   * behalten die geglättete Perturbation. Default `false`.
   */
  occurrenceSampling?: boolean;
  /**
   * Sammelt je Durchlauf die *gezogenen Annahmen* (variable Ausgaben je Kategorie
   * und perturbierte Einnahmen) und gibt sie in {@link MonteCarloResult.assumptions}
   * zurück (aligned mit {@link MonteCarloResult.paths}). Default `false` – nur
   * aktivieren, wenn die Annahmen sichtbar gemacht werden (z. B. Heatmap-Zell-
   * Details), da pro Durchlauf eine kompakte Struktur entsteht.
   */
  collectAssumptions?: boolean;
}

/**
 * Die in EINEM Durchlauf gezogene variable Ausgabe einer Kategorie – der
 * eigentliche Streu-Treiber des Monte-Carlo (Fixkosten/Transfers sind je
 * Durchlauf identisch). `monthly` hält die realisierten Monatsbeträge, sodass
 * sich der kumulierte Wert bis zu einem beliebigen Tag rekonstruieren lässt.
 */
export interface CategoryAssumption {
  category: string;
  /** Planwert pro Monat (EUR, positiv) – Budget-Override oder Historie. */
  plannedMonthly: number;
  /** Realisierte Ausgabe je Monat (yyyy-MM → EUR, positiv) in diesem Durchlauf. */
  monthly: Record<string, number>;
}

/** Die in EINEM Durchlauf gezogene Einnahme eines perturbierten Flows. */
export interface IncomeAssumption {
  name: string;
  /** Planbetrag je Vorkommen (EUR, positiv). */
  planned: number;
  /** Realisierter Betrag je Vorkommen (EUR, positiv) in diesem Durchlauf. */
  sampled: number;
}

/**
 * Die gezogenen Annahmen EINES Monte-Carlo-Durchlaufs. Macht die Frage „welche
 * konkreten Werte haben diesen Pfad erzeugt?" beantwortbar, ohne den Engine-Kern
 * zu verändern.
 */
export interface TrialAssumptions {
  variableByCategory: CategoryAssumption[];
  income: IncomeAssumption[];
}

/** Aufgelöste Konfiguration (alle Defaults gesetzt). */
export interface ResolvedMonteCarloConfig {
  trials: number;
  seed: number;
  variableVolatility: number | null;
  incomeVolatility: number;
  occurrenceSampling: boolean;
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
  /**
   * Die einzelnen Trial-Pfade der maßgeblichen Cash-Sicht (pfad-major:
   * `paths[trial][tag]`). Nur gesetzt, wenn {@link MonteCarloConfig.collectPaths}
   * aktiviert wurde. Grundlage für Stress-Capacity und tagesgenaue Breach-Kurven.
   */
  paths?: number[][];
  /**
   * Die gezogenen Annahmen je Durchlauf (aligned mit {@link paths}). Nur gesetzt,
   * wenn {@link MonteCarloConfig.collectAssumptions} aktiviert wurde. Macht die
   * Heatmap-Zellen erklärbar: welche konkreten Werte einen Pfad erzeugt haben.
   */
  assumptions?: TrialAssumptions[];
}
