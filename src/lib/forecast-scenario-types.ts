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
  | 'income' // skaliert ALLE Einnahmen (positive Flows) – grobe Sammeländerung
  | 'expenses' // skaliert ALLE fixe Ausgaben (negative Flows) – grobe Sammeländerung
  | 'variable' // skaliert die variable Ausgaben-Baseline
  | 'interest' // verändert Zinssätze (Prozentpunkte, absolut)
  | 'oneTime' // einmaliger Schock (geplanter Posten)
  | 'recurring' // neue wiederkehrende Verpflichtung
  | 'flow'; // skaliert/deaktiviert konkrete, erkannte Einträge (Gehalt, Unterhalt …)

/**
 * Auswahlregel für `flow`-Modifikatoren. Ein Jobverlust ist eben *nicht*
 * „alle Einnahmen −100 %" (Nebenjob/Unterhalt blieben ja), sondern „der größte
 * erkannte Einkommens-Eintrag fällt weg". Deshalb treffen Szenarien konkrete
 * Einträge statt pauschaler Prozentsätze:
 *  - `ids`: explizite Flow-IDs (was der Editor speichert).
 *  - `largestIncome`: der größte (monatlich normierte) Einkommens-Eintrag.
 *  - `keyword`: Einträge, deren Name/Kategorie das Schlüsselwort enthält
 *    (z. B. „unterhalt"), optional gefiltert nach Richtung.
 */
export type FlowSelector =
  | { kind: 'ids'; ids: string[] }
  | { kind: 'largestIncome' }
  | { kind: 'keyword'; keyword: string; direction?: 'income' | 'expense' };

/**
 * Ein einzelner Modifikator. Welche Felder relevant sind, hängt vom `type` ab:
 *  - income / expenses / variable: `percentChange` (und optional `fromDate`).
 *  - interest: `amount` als Prozentpunkt-Delta (z. B. +1.5).
 *  - oneTime: `amount` (signiert) + `date` + optional `accountId`.
 *  - recurring: `amount` (signiert) + `cadence` + `anchorDate` + optional `accountId`.
 *  - flow: `flowSelector` (welche Einträge) + `factor` (0 = aus, 0.7 = −30 %)
 *    und optional `fromDate`.
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
  /** Für `flow`: welche erkannten Einträge getroffen werden. */
  flowSelector?: FlowSelector;
  /**
   * Für `flow`: Faktor auf die getroffenen Einträge. 0 = Eintrag entfällt,
   * 0.7 = auf 70 % (Krankengeld), 1.05 = +5 % (Gehaltserhöhung).
   */
  factor?: number;
  /** Wirksam ab diesem Datum (income/expenses/flow) – davor gilt der Originalwert. */
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
