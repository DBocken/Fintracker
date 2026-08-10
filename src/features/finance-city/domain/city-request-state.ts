/**
 * Anzeigezustand der Stadt-Fläche (WP 6.4, Befund DOM-5).
 *
 * `useCityModel` liefert `isLoading`/`isError`/`isEmpty` als drei UNABHÄNGIGE
 * Booleans — sie können gleichzeitig wahr sein (ein Lesefehler liefert immer
 * auch ein leeres Modell). Welcher Zustand dann gewinnt, stand bis WP 6.4
 * ausschließlich in der if/else-Reihenfolge des JSX (`CityPage.tsx:790-801`):
 * eine Rangfolge, die kein Test prüfen konnte und die beim nächsten Umbau der
 * Fläche unbemerkt kippt.
 *
 * Die Rangfolge selbst bleibt unverändert — sie war richtig:
 *
 * 1. `loading` — solange geladen wird, ist jede Aussage über den Bestand
 *    verfrüht.
 * 2. `error` — VOR `empty` (WP-9.6). Eine leere Stadt heißt „du hast noch
 *    nichts erfasst"; bei einem Lesefehler ist das die falscheste Aussage,
 *    die dieser Screen treffen kann.
 * 3. `empty` — echte Leere, kein Canvas (spart den WebGL-Kontext).
 * 4. `ready` — Daten da.
 */

export type CityRequestState = 'loading' | 'error' | 'empty' | 'ready';

export type CityRequestFlags = {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
};

export function deriveCityRequestState({ isLoading, isError, isEmpty }: CityRequestFlags): CityRequestState {
  if (isLoading) return 'loading';
  if (isError) return 'error';
  if (isEmpty) return 'empty';
  return 'ready';
}
