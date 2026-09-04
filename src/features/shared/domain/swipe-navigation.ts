/**
 * Wisch-Geste zwischen mobilen Ansichten — eine Quelle für alle Slices.
 *
 * Lag bis hierher als `resolveSwipeTarget` in
 * `features/dashboard/presentation/mobile/DashboardMobileStory.tsx`. Mit der
 * Coach-Slice ist es die **zweite** mobile Fläche mit derselben Geste; nach
 * `docs/architecture/feature-structure.md` wandert Fachlogik, die von ≥ 2
 * Slices gebraucht wird, nach `features/shared/`. Eine Kopie hätte genau das
 * Fehlerbild erzeugt, das die Schwellen unsichtbar macht: zwei Flächen, die
 * sich unterschiedlich anfühlen, ohne dass irgendwo eine Entscheidung dazu
 * steht.
 *
 * Bewusst reine Funktion ohne React und ohne Browser-API — dadurch ohne DOM
 * testbar (`domain/`-Regel, AGENTS.md §3).
 */

/**
 * Mindestweg in Pixeln, ab dem eine Bewegung als Wisch gilt. Darunter ist es
 * ein Antippen mit unruhigem Daumen — auf einem Telefon bewegt sich der
 * Kontaktpunkt praktisch immer ein paar Pixel.
 */
export const SWIPE_MIN_DISTANCE_PX = 50;

/**
 * Zielindex nach einer Wisch-Geste.
 *
 * Zwei Schutzregeln, beide aus dem Bestand gelernt:
 * - **Vertikales gewinnt.** Ist der senkrechte Anteil mindestens so gross wie
 *   der waagerechte, war es Scrollen. Ohne diese Regel wechselt die Ansicht
 *   beim Herunterscrollen mit leicht schräg geführtem Daumen.
 * - **Ränder halten.** Am ersten/letzten Eintrag passiert nichts, statt in
 *   einen ungültigen Index zu laufen.
 *
 * @param index aktueller Index
 * @param deltaX zurückgelegter Weg waagerecht (negativ = nach links gewischt)
 * @param deltaY zurückgelegter Weg senkrecht
 * @param viewCount Anzahl der Ansichten
 */
export function resolveSwipeTarget(
  index: number,
  deltaX: number,
  deltaY: number,
  viewCount: number,
): number {
  if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE_PX || Math.abs(deltaX) <= Math.abs(deltaY)) return index;
  const direction = deltaX < 0 ? 1 : -1;
  return Math.min(viewCount - 1, Math.max(0, index + direction));
}
