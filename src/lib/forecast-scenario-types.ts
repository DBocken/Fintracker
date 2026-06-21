/**
 * Forecast Engine – Szenario-Typen (Stufe 3: Was-wäre-wenn)
 *
 * Ein Szenario ist ein benanntes Bündel von **Modifikatoren**, die eine
 * {@link ForecastInput} deterministisch transformieren. Der Kern-Engine bleibt
 * unverändert: ein Szenario rechnet, indem der transformierte Input erneut durch
 * `calculateDeterministicForecast` läuft. Dadurch ist jede Was-wäre-wenn-Frage
 * exakt so präzise wie die Basis-Projektion – ohne Code-Duplikat.
 *
 * Beispiele:
 *  - Jobverlust: Einnahmen ab Datum X auf 0 (income, percentChange -100, fromDate)
 *  - Gehaltserhöhung: Einnahmen +5 % (income, percentChange +5)
 *  - Inflation: fixe + variable Ausgaben +10 %
 *  - Große Anschaffung: einmaliger Abfluss (oneTime)
 *  - Neue Rate: zusätzliche wiederkehrende Verpflichtung (recurring)
 *  - Zinswende: Zinssätze +/- X Prozentpunkte (interest)
 */
import type { RecurringCadence } from './forecast-types';

/** Art eines Szenario-Modifikators. */
export type ScenarioModifierType =
  | 'income' // skaliert Einnahmen (positive Flows)
  | 'expenses' // skaliert fixe Ausgaben (negative Flows)
  | 'variable' // skaliert die variable Ausgaben-Baseline
  | 'interest' // verändert Zinssätze (Prozentpunkte, absolut)
  | 'oneTime' // einmaliger Schock (geplanter Posten)
  | 'recurring'; // neue wiederkehrende Verpflichtung

/**
 * Ein einzelner Modifikator. Welche Felder relevant sind, hängt vom `type` ab:
 *  - income / expenses / variable: `percentChange` (und optional `fromDate`).
 *  - interest: `amount` als Prozentpunkt-Delta (z. B. +1.5).
 *  - oneTime: `amount` (signiert) + `date` + optional `accountId`.
 *  - recurring: `amount` (signiert) + `cadence` + `anchorDate` + optional `accountId`.
 */
export interface ScenarioModifier {
  id: string;
  type: ScenarioModifierType;
  /** Prozentuale Änderung für income/expenses/variable (-100 = Wegfall, +10 = +10 %). */
  percentChange?: number;
  /**
   * Absoluter Betrag: signierter Euro-Betrag für oneTime/recurring,
   * Prozentpunkt-Delta für interest.
   */
  amount?: number;
  /** Wirksam ab diesem Datum (income/expenses) – davor gilt der Originalwert. */
  fromDate?: string;
  /** Anzeigename für oneTime/recurring. */
  label?: string;
  /** Für oneTime: Buchungsdatum (ISO yyyy-mm-dd). */
  date?: string;
  /** Für recurring: Rhythmus. */
  cadence?: RecurringCadence;
  /** Für recurring: Anker-Fälligkeit (ISO yyyy-mm-dd). */
  anchorDate?: string;
  /** Zielkonto für oneTime/recurring (Default: erstes operatives Konto). */
  accountId?: string;
}

/** Ein benanntes Szenario als Bündel von Modifikatoren. */
export interface ForecastScenario {
  id: string;
  name: string;
  description?: string;
  modifiers: ScenarioModifier[];
}

/** Vergleichswert einer Kennzahl: Basis vs. Szenario plus Differenz. */
export interface ScenarioMetricDelta {
  baseline: number;
  scenario: number;
  /** scenario − baseline. Negativ = das Szenario verschlechtert die Lage. */
  delta: number;
}

/** Ergebnis eines Szenario-Vergleichs gegen die Basis-Projektion. */
export interface ScenarioComparison {
  scenario: ForecastScenario;
  /** Tiefststand der maßgeblichen Cash-Sicht über den Horizont. */
  lowestBalance: ScenarioMetricDelta;
  /** Minimaler operativer Bestand (Giro). */
  minimumOperatingCash: ScenarioMetricDelta;
  /** Vermögen am Ende des Horizonts. */
  endingNetWorth: ScenarioMetricDelta;
  /** Tage unter dem Sicherheitspuffer. */
  daysBelowSafetyBuffer: ScenarioMetricDelta;
  /**
   * Verschiebung des ersten Pufferbruchs in Kalendertagen (scenario − baseline).
   * Negativ = das Szenario zieht den Bruch vor. `null`, wenn der Vergleich nicht
   * sinnvoll ist (in genau einer Variante tritt gar kein Bruch auf).
   */
  firstBreachShiftDays: number | null;
}
