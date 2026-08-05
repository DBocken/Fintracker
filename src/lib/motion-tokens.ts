/**
 * Zentrales Motion-Token-System für FinTracker (WP-2.1).
 *
 * Definiert die universelle Bewegungssprache der Anwendung: 5 Easing-Kurven
 * für verschiedene Bewegungscharaktere und 4 Dauer-Stufen. Diese Werte sind
 * die einzige Quelle der Wahrheit für Bewegungsdauer und -kurven — niemals
 * hartcodierte Werte in Komponenten.
 *
 * Designentscheidung (Art Director):
 * - precision (expo-out): Standard-Interaktionen — schnell hinein, langes
 *   sanftes Auslaufen. Die dominante Kurve für Karten, Tabs, Dialoge.
 * - build (easeOutCubic): Datendarstellung — gleichmäßiges Wachstum, sanftes
 *   Ende. Für Zahlen-Hochzählen, Balken-Wachsen, Tank-Füllen.
 * - spatial (easeInOutCubic): Räumliche Bewegung — symmetrisch, kontrolliert.
 *   Für Kamera-Fahrten, Shared-Element-Transitions.
 * - confirm (overshoot): Erfolgsmomente — leichtes Überschwingen, das
 *   „Ankommen" signalisiert. Für Celebrations, Zielerreichung.
 * - warn (easeInOutExpo): Warnungen — hart, schnell, kein Komfort.
 *   Für Budgetüberschreitungen, negative Entwicklungen.
 *
 * @see docs/aaa-plus/tdd-specs.md — WP-2.1
 */

/** Die fünf kanonischen Easing-Kurven als CSS cubic-bezier()-Strings. */
export const MOTION_EASINGS = {
  /** Expo-out: schneller Start, langes sanftes Auslaufen. Standard-Interaktion. */
  precision: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /** easeOutCubic-Variante: gleichmäßiges Wachstum mit sanftem Ende. Datendarstellung. */
  build: 'cubic-bezier(0.33, 1, 0.68, 1)',
  /** easeInOutCubic: symmetrisch, kontrolliert. Räumliche Bewegung. */
  spatial: 'cubic-bezier(0.65, 0, 0.35, 1)',
  /** Overshoot: leichtes Überschwingen. Erfolgsmomente, Bestätigung. */
  confirm: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  /** easeInOutExpo: hart, schnell, ohne Komfortkurve. Warnungen, Risiko. */
  warn: 'cubic-bezier(0.87, 0, 0.13, 1)',
} as const;

/** Die vier Dauer-Stufen in Millisekunden. */
export const MOTION_DURATIONS = {
  /** 150ms — Hover, Press, Mikrointeraktionen. */
  fast: 150,
  /** 300ms — Standard-Übergänge, Tab-Wechsel, Dialog-Öffnen. */
  default: 300,
  /** 600ms — Räumliche Bewegung, Kamera, Shared-Element-Transitions. */
  slow: 600,
  /** 1200ms — Signature Moments (Ziel erreicht, Stadtaufbau). */
  signature: 1200,
} as const;

/**
 * Löst eine Bewegungsdauer in Abhängigkeit von `prefers-reduced-motion` auf.
 * Bei aktivierter Reduced-Motion wird immer `0` geliefert (die CSS-Media-Query
 * fängt zusätzliche Transition/Animation-Dauern global ab).
 */
export function resolveDuration(duration: number, reduced: boolean): number {
  return reduced ? 0 : duration;
}

/**
 * CSS-Variablen für Motion-Tokens, injizierbar als Inline-Style-String
 * oder direkt in `:root` (index.css). Jeder Token-Wert wird als
 * `--motion-easing-*` bzw. `--motion-duration-*` verfügbar.
 */
export const MOTION_CSS_VARS = {
  '--motion-easing-precision': MOTION_EASINGS.precision,
  '--motion-easing-build': MOTION_EASINGS.build,
  '--motion-easing-spatial': MOTION_EASINGS.spatial,
  '--motion-easing-confirm': MOTION_EASINGS.confirm,
  '--motion-easing-warn': MOTION_EASINGS.warn,
  '--motion-duration-fast': `${MOTION_DURATIONS.fast}ms`,
  '--motion-duration-default': `${MOTION_DURATIONS.default}ms`,
  '--motion-duration-slow': `${MOTION_DURATIONS.slow}ms`,
  '--motion-duration-signature': `${MOTION_DURATIONS.signature}ms`,
} as const;
