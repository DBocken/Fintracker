/**
 * WP-6.6 — Live-Reorganisation von Listen bei Filterwechsel.
 *
 * Wenn ein Filter greift, soll die Liste sich sichtbar **umsortieren** statt
 * neu aufzupoppen: Zeilen, die bleiben, wandern an ihren neuen Platz;
 * Zeilen, die wegfallen, gehen; neue kommen dazu. Das ist Objektkontinuität —
 * der Nutzer sieht, dass „die Aldi-Buchung noch da ist, nur weiter oben",
 * statt eine neue Liste vorgesetzt zu bekommen.
 *
 * Diese Datei entscheidet **ob** animiert wird. Das ist keine Formalie: es
 * gibt drei Lagen, in denen eine Layout-Animation falsch wäre, und sie
 * stillschweigend zu übergehen hieße, entweder die Barrierefreiheit oder die
 * Bildrate zu opfern.
 */

import { MOTION_DURATIONS } from './motion-tokens';
import { resolveMotionDuration, type MotionQualitySettings } from './motion-quality';

/** Warum animiert wird — oder eben nicht. */
export type ReorganizationReason =
  | 'ok'
  /** Der Nutzer hat reduzierte Bewegung verlangt. */
  | 'reduced-motion'
  /** Mehr Elemente, als die Bewegungsstufe gleichzeitig verträgt. */
  | 'too-many'
  /**
   * Die Liste ist fenster-virtualisiert. Dort positioniert der Virtualizer
   * jede Zeile per `transform`; eine Layout-Animation würde gegen ihn
   * arbeiten und beim Scrollen sichtbar zappeln.
   */
  | 'virtualized';

export type ReorganizationPlan = {
  animate: boolean;
  /** Dauer in Millisekunden, bereits gegen die Bewegungsstufe aufgelöst. */
  durationMs: number;
  reason: ReorganizationReason;
};

export type ReorganizationOptions = {
  /** Zahl der Elemente, die sich gleichzeitig bewegen würden. */
  itemCount: number;
  /** Ob die Liste fenster-virtualisiert gerendert wird. */
  virtualized: boolean;
  settings: MotionQualitySettings;
};

/**
 * Entscheidet, ob und wie lange sich eine Liste umsortieren darf.
 *
 * Die Reihenfolge der Prüfungen ist eine Rangfolge: die Nutzeraussage
 * (`prefers-reduced-motion`) steht über der Technik, und die Technik
 * (Virtualisierung) über der Mengenfrage — eine virtualisierte Liste darf
 * auch dann nicht animieren, wenn gerade nur drei Zeilen sichtbar sind.
 */
export function planListReorganization({
  itemCount,
  virtualized,
  settings,
}: ReorganizationOptions): ReorganizationPlan {
  const durationMs = resolveMotionDuration(MOTION_DURATIONS.default, settings);

  if (durationMs === 0) return { animate: false, durationMs: 0, reason: 'reduced-motion' };
  if (virtualized) return { animate: false, durationMs: 0, reason: 'virtualized' };
  if (itemCount > settings.maxAnimatedItems) {
    // Bewusst ganz aus statt „die ersten N animieren": eine Liste, in der die
    // oberen Zeilen gleiten und die unteren springen, sieht kaputt aus — nicht
    // sparsam.
    return { animate: false, durationMs: 0, reason: 'too-many' };
  }

  return { animate: true, durationMs, reason: 'ok' };
}
