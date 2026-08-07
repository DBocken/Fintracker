/**
 * WP-7.3 — Ladeverhalten (Liquid Loading), der zeitliche Teil.
 *
 * Die *Optik* des Ladezustands ist erledigt (WP-3.4: `Skeleton variant="shimmer"`).
 * Was fehlte, ist die **Choreografie** — und die entscheidet darüber, ob ein
 * Ladezustand hilft oder stört:
 *
 * - Lädt etwas in 40 ms, ist ein Skeleton kein Ladezustand, sondern ein
 *   Blinzeln. Der Nutzer sieht ein Zucken und kann nicht sagen, was passiert
 *   ist. Besser: unter einer Schwelle gar nichts zeigen.
 * - Ist das Skeleton einmal da, muss es lange genug bleiben, um gelesen zu
 *   werden. Sonst entsteht dasselbe Zucken am anderen Ende — Daten treffen
 *   20 ms nach dem Skeleton ein und es verschwindet sofort wieder.
 *
 * Beide Regeln sind reine Zeitrechnung und stehen deshalb hier, nicht im
 * Hook: so lassen sie sich ohne Timer und ohne DOM prüfen.
 */

/**
 * So lange bleibt die Fläche leer, bevor ein Skeleton erscheint.
 *
 * Unterhalb davon ist das Laden schneller, als ein Mensch einen Zustandswechsel
 * als solchen erkennt — ein Skeleton wäre dort reine Unruhe.
 */
export const SKELETON_DELAY_MS = 150;

/**
 * So lange bleibt ein einmal gezeigtes Skeleton mindestens stehen.
 *
 * Kürzer gezeigt wäre es ein zweites Zucken statt einer Auskunft.
 */
export const SKELETON_MIN_VISIBLE_MS = 300;

/** Was gerade an der Stelle steht. */
export type LoadingPhase =
  /** Nichts — es lädt, aber noch zu kurz für einen Ladezustand. */
  | 'blank'
  /** Der Ladezustand. */
  | 'skeleton'
  /** Der Inhalt. */
  | 'content';

export type LoadingPhaseInput = {
  loading: boolean;
  /** Millisekunden seit Beginn des Ladens; `null`, wenn nicht geladen wird. */
  loadingForMs: number | null;
  /** Millisekunden, seit das Skeleton sichtbar ist; `null`, wenn es nie erschien. */
  skeletonVisibleForMs: number | null;
};

/**
 * Entscheidet, was gerade zu sehen ist.
 *
 * Der interessante Fall ist der letzte: Das Laden ist **fertig**, aber das
 * Skeleton stand noch nicht lange genug. Dann bleibt es — der Inhalt wartet
 * kurz, statt den Nutzer zucken zu lassen.
 */
export function resolveLoadingPhase({
  loading,
  loadingForMs,
  skeletonVisibleForMs,
}: LoadingPhaseInput): LoadingPhase {
  if (loading) {
    if (skeletonVisibleForMs !== null) return 'skeleton';
    return (loadingForMs ?? 0) >= SKELETON_DELAY_MS ? 'skeleton' : 'blank';
  }

  // Fertig geladen — aber ein gerade erst erschienenes Skeleton bleibt noch.
  if (skeletonVisibleForMs !== null && skeletonVisibleForMs < SKELETON_MIN_VISIBLE_MS) {
    return 'skeleton';
  }
  return 'content';
}

/**
 * Wie lange ein Skeleton noch stehen bleiben muss, bevor der Inhalt darf.
 * `0`, wenn sofort gewechselt werden kann.
 */
export function remainingSkeletonMs(skeletonVisibleForMs: number | null): number {
  if (skeletonVisibleForMs === null) return 0;
  return Math.max(0, SKELETON_MIN_VISIBLE_MS - skeletonVisibleForMs);
}
