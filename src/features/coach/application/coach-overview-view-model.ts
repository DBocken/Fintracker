import type { CoachOverview, CoachRecommendation } from '@/types';
import type { FinancialHealth } from '@/services/financial-health-service';
import type { MilestoneStatus } from '@/lib/milestone-types';
import type { DisposableUntilPayday } from '@/lib/disposable-budget';

/**
 * UI-neutrales ViewModel der Coach-Fläche. Enthält keine Darstellungs-
 * entscheidungen (keine Farben, Kartengrößen, Spaltenzahlen, kein JSX) —
 * Desktop- und Mobile-Präsentation konsumieren dasselbe Objekt aus
 * `useCoachOverview()` (AGENTS.md §4: gleiche Daten, gleiche Berechnungen,
 * gleiches ViewModel).
 *
 * **Warum `focus` und `followUps` hier stehen und nicht in der Präsentation.**
 * Welche Empfehlung die wichtigste ist, ist eine fachliche Rangfolge (der
 * `coach-service` sortiert sie), keine Layout-Frage. Beide Präsentationen
 * müssen denselben ersten Schritt zeigen — mobil als einzige Hauptaussage,
 * auf dem Desktop als hervorgehobene Karte über den übrigen. Läge die
 * Aufteilung in der Präsentation, könnten die beiden Oberflächen
 * auseinanderlaufen, ohne dass etwas rot wird.
 */
export type CoachViewModel = {
  /** Die Coach-Auswertung lädt noch. Betrifft Fokuskarte und Health-Score. */
  loading: boolean;
  /**
   * Es gibt nachweislich **keine** Finanzdaten — nach Ladeende und **nur bei
   * gelungenem Laden**. Schliesst `hasError` aus: „noch nichts erfasst" und
   * „nicht ladbar" sind verschiedene Aussagen und brauchen verschiedene
   * Darstellungen. Genau diese Verwechslung ist der teuerste Fehler dieser
   * Fläche — sie fordert zum Neuerfassen von Daten auf, die längst da sind.
   */
  isEmpty: boolean;
  /** Mindestens eine der vier Abfragen ist gescheitert. */
  hasError: boolean;
  /** Lädt **alle** gescheiterten Abfragen neu, nicht nur eine. */
  retry: () => void;

  coach: CoachOverview | undefined;
  health: FinancialHealth | undefined;
  milestones: MilestoneStatus[] | undefined;
  /** Eigenes Flag: Meilensteine laden unabhängig von der Coach-Auswertung. */
  milestonesLoading: boolean;

  /**
   * Summe der Kontostände — die Zahl, die ein Nutzer beim Öffnen zuerst
   * sucht. `null` heißt „noch nicht geladen", nicht „null Euro".
   */
  accountsBalance: number | null;

  /**
   * „Wie viel bleibt bis zum nächsten Gehalt?" — die eine Zahl, für die es
   * eine Coach-Fläche heute gibt.
   *
   * `null` heißt **nicht bestimmbar**, nicht „null Euro": Ohne erkannten
   * regelmäßigen Geldeingang gibt es kein „bis zum Gehalt", und eine 0 an
   * dieser Stelle wäre eine falsche Auskunft statt einer fehlenden.
   */
  disposable: DisposableUntilPayday | null;
  /** Eigenes Flag: Die Prognosedaten laden unabhängig von der Coach-Auswertung. */
  disposableLoading: boolean;

  /**
   * Der eine priorisierte nächste Schritt — `undefined`, wenn gerade nichts
   * ansteht. Das ist ein eigener Zustand („alles im Griff") und nicht
   * dasselbe wie „lädt noch".
   */
  focus: CoachRecommendation | undefined;
  /** Alle übrigen Empfehlungen in Rangfolge, ohne `focus`. */
  followUps: CoachRecommendation[];
  /**
   * Es gibt offene Schulden. Entscheidet, ob die Fläche den Schuldenkontext
   * oder die Schuldenfreiheit zeigt — fachliche Fallunterscheidung, keine
   * Layout-Frage, deshalb hier und nicht zweimal in den Präsentationen.
   */
  hasDebt: boolean;
};
