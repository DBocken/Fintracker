/**
 * Zustandstypen der eToro-Ansicht — welcher Nachrichtenfilter aktiv ist und
 * welches Instrument in der Suche gewählt wurde.
 *
 * Sie standen zuvor in `components/trading/EtoroNewsTab.tsx` bzw.
 * `EtoroDiscoverTab.tsx`, weil sie dort zuerst gebraucht wurden — und das
 * ViewModel `use-etoro-account.ts` hat sie von dort geholt. Damit hing die
 * Anwendungsschicht an zwei konkreten React-Komponentendateien: Eine zweite
 * Präsentation hätte die alte Oberfläche mitschleppen müssen, nur damit ein
 * `import type` noch auflöst.
 *
 * Es sind fachliche Zustände, keine Darstellungsentscheidungen: WELCHE
 * Nachrichten gezeigt werden, nicht wie. Deshalb liegen sie in der `domain`
 * (AGENTS.md §3, „Wohin ein Typ gehört") und werden von der Präsentation
 * gelesen, nicht besessen.
 */

/** Welche Nachrichten die Ansicht zeigt: alle oder nur zu eigenen Positionen. */
export type EtoroNewsFilter = 'all' | 'my-positions';

/** Ein in der Instrumentensuche auswählbares Instrument. */
export interface EtoroDiscoverInstrumentOption {
  instrumentId: number;
  name: string;
}
