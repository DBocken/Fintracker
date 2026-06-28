/**
 * FinRisk – Szenario-Payload- und Ergebnis-Typen (v27)
 *
 * Das UI fragt Szenarien nicht als manuelles Budget ab, sondern als gezielte
 * Modellveränderung. Diese Typen bilden das `schema/scenario_payload.schema.json`
 * aus dem v27-Paket ab und definieren die Engine-Ausgaben (ScenarioResult,
 * StressCapacity). Sie sind die UI-nahe, stabile Vertragsschicht; intern werden
 * Payloads über den Adapter auf den bestehenden Szenario-/Monte-Carlo-Apparat
 * abgebildet (kein paralleler Zweit-Apparat).
 *
 * Privatsphäre: Diese Strukturen bleiben lokal. Es werden keine Transaktionen,
 * Salden, Forecasts oder Szenario-Ergebnisse an ein Backend gesendet.
 */
import type { DensityField } from './density';
import type { TrialAssumptions } from '../forecast-montecarlo-types';

/** Fachlicher Szenario-Typ (Frage, die der Nutzer stellt). */
export type ScenarioType =
  | 'base_check'
  | 'large_purchase'
  | 'income_loss'
  | 'higher_cost_of_living'
  | 'shock_recovery'
  | 'stress_capacity'
  | 'custom_combination';

/** Art eines einzelnen Szenario-Ereignisses. */
export type ScenarioEventType = 'expense' | 'income' | 'income_reduction' | 'baseline_multiplier';

/** Modellschicht, der ein Ereignis zugeordnet ist (für Debug/Erklärung). */
export type ScenarioLayer =
  | 'income_layer'
  | 'recurring_layer'
  | 'baseline_layer'
  | 'lumpy_layer'
  | 'stress_layer'
  | 'recovery_layer';

/**
 * Ein einzelnes Ereignis im Payload. Welche Felder relevant sind, hängt vom
 * `eventType` ab:
 *  - `expense` / `income`: `amount` (positiv) + `dayIndex`.
 *  - `income_reduction`: `amount` (EUR/Tag) über `[startDayIndex, endDayIndex]`.
 *  - `baseline_multiplier`: `amount` als Faktor (z. B. 1.2 = +20 %).
 */
export interface ScenarioEvent {
  eventType: ScenarioEventType;
  /** Positive Zahl. Richtung/Bedeutung ergibt sich aus `eventType`. */
  amount: number;
  dayIndex?: number;
  startDayIndex?: number;
  endDayIndex?: number;
  /** Eintrittswahrscheinlichkeit (0..1). Default 1. */
  probability?: number;
  layer?: ScenarioLayer;
  description?: string;
}

/** Stabiles Szenario-Payload aus der UI. */
export interface ScenarioPayload {
  scenarioId: string;
  scenarioType: ScenarioType;
  /** Horizont in Tagen (1..730). */
  timeHorizonDays: number;
  /** Gesamt-Eintrittswahrscheinlichkeit des Szenarios (0..1). Default 1. */
  probability?: number;
  /** Mindestpuffer / Sicherheitsgrenze in EUR. */
  thresholdAmount?: number;
  events?: ScenarioEvent[];
  /** Globaler Baseline-Faktor (z. B. 1.2 = Alltag +20 %). */
  baselineMultiplier?: number;
  /** Sicherheitsniveaus für die Stress-Capacity. Default [0.8, 0.9, 0.95]. */
  confidenceLevels?: number[];
  notes?: string;
}

/** Stress-Tragfähigkeit für genau ein Sicherheitsniveau. */
export interface StressCapacityLevel {
  /** Sicherheitsniveau (0..1), z. B. 0.9 für 90 %. */
  confidenceLevel: number;
  /** Zugrunde gelegter Mindestpuffer in EUR. */
  thresholdAmount: number;
  /** Wie teuer ein zusätzlicher Schock höchstens sein darf (EUR, >= 0). */
  maxAffordableShock: number;
  /** Tagesindex mit dem geringsten Abstand zum Puffer (Median-Pfad). */
  criticalDay: number;
  /** Nutzerverständliche Erklärung – immer mit Sicherheitsniveau, nie absolut. */
  interpretation: string;
}

/** Ergebnis einer Szenario-Auswertung. */
export interface ScenarioResult {
  scenarioId: string;
  scenarioType: ScenarioType;
  /** Median-Endstand der Basis-Projektion (maßgebliche Cash-Sicht). */
  baselineEndP50: number;
  /** Median-Endstand nach Szenario. */
  scenarioEndP50: number;
  /** scenarioEndP50 − baselineEndP50 (negativ = Verschlechterung). */
  deltaEndP50: number;
  /** Tagesgenaue Pufferbruch-Wahrscheinlichkeit je Schwelle (0..1). */
  breachProbabilities: Record<string, number[]>;
  /** Stress-Tragfähigkeit je Sicherheitsniveau. */
  stressCapacity: StressCapacityLevel[];
  /** Nutzerverständliche Diagnose inkl. Disclaimer. */
  diagnosis: string;
  /** Hinweise (z. B. dünne Datenlage, Annahmen). */
  warnings: string[];
  /** Tagesgenaue P10/P50/P90-Bandbreite nach Szenario. */
  daily: Array<{ date: string; p10: number; p50: number; p90: number }>;
  /**
   * Wert×Tag-Dichtefeld der gemischten Pfade – die Datengrundlage der
   * Wahrscheinlichkeits-Heatmap. Bildet multimodale Verteilungen ab, die ein
   * P10/P50/P90-Band nicht zeigen kann.
   */
  density: DensityField;
  /** Effektiv ausgewertetes Fenster in Tagen (= Länge von `daily`/Heatmap). */
  horizonDays: number;
  /**
   * Gezogene Annahmen je (gemischtem) Durchlauf – aligned mit den Pfaden hinter
   * `density`. Macht die Heatmap-Zellen anklickbar erklärbar („welche konkreten
   * Werte erzeugten diesen Saldo?"). Optional: nur gesetzt, wenn der Lauf die
   * Annahmen gesammelt hat.
   */
  assumptions?: TrialAssumptions[];
  /**
   * Repräsentativer Durchlauf je Heatmap-Zelle: `representativeByCell[tag][bin]`
   * ist der Index in `assumptions` des Pfads, der am nächsten am Bin-Zentrum
   * liegt (oder -1, wenn die Zelle leer ist). Kompakt statt aller Pfade, damit
   * das Ergebnis schlank über die Worker-Grenze klont.
   */
  representativeByCell?: number[][];
}
