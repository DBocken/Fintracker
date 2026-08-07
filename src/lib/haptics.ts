/**
 * WP-7.8 — Haptisches Feedback (Mobil).
 *
 * Haptik ist die vierte Ausgabe neben Bild, Bewegung und Ton, und sie folgt
 * derselben Semantik wie die Bewegungssprache: ein `confirm` fühlt sich anders
 * an als ein `warn`. Diese Datei bildet die Motion-Semantik auf
 * Vibrationsmuster ab — rein und ohne Browser-Zugriff, damit die Zuordnung
 * ohne Gerät prüfbar bleibt.
 *
 * **Warum `navigator.vibrate` und nicht `@capacitor/haptics`:** Das Paket ist
 * hier nicht installiert, und eine neue Abhängigkeit für ein P3-Arbeitspaket
 * hieße Lockfile-Bewegung plus einen weiteren Posten im OSV-Scan (AGENTS.md
 * §10.7). Die einzige Capacitor-Zielplattform dieses Repos ist Android
 * (`@capacitor/android`, kein iOS-Target), und dessen WebView unterstützt
 * `navigator.vibrate` nativ. Käme später ein iOS-Target dazu, wäre
 * `@capacitor/haptics` nötig — Safari kennt `vibrate` nicht; die Aufrufstelle
 * (`useHaptics`) bliebe dabei unverändert.
 *
 * Die Muster sind bewusst kurz. Haptik, die man bewusst wahrnimmt, ist zu
 * lang: sie soll eine Rückmeldung unterstreichen, nicht selbst eine sein.
 */

/** Die Anlässe, zu denen es überhaupt eine Rückmeldung gibt. */
export type HapticKind =
  /** Auswahl, Umschalten, Tab-Wechsel — die leiseste Stufe. */
  | 'select'
  /** Erfolg, Zielerreichung — korrespondiert mit `MOTION_EASINGS.confirm`. */
  | 'confirm'
  /** Warnung, Budgetüberschreitung — korrespondiert mit `MOTION_EASINGS.warn`. */
  | 'warn';

/**
 * Vibrationsmuster je Anlass, in Millisekunden.
 *
 * Ein einzelner Wert ist ein Impuls; ein Array wechselt zwischen Vibrieren und
 * Pause (`[an, aus, an, …]`). `warn` ist bewusst zweiteilig — ein Doppelimpuls
 * ist als Unterbrechung lesbar, ein längerer einzelner nur als stärker.
 */
const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  select: 10,
  confirm: [12, 40, 24],
  warn: [30, 60, 30],
};

/** Das Vibrationsmuster für einen Anlass. */
export function hapticPattern(kind: HapticKind): number | number[] {
  return HAPTIC_PATTERNS[kind];
}

/**
 * Gesamtdauer eines Musters inklusive Pausen.
 *
 * Dient als Wächter gegen zu lange Muster: Haptik, die man bewusst wahrnimmt,
 * lenkt vom Inhalt ab, statt ihn zu stützen.
 */
export function hapticDurationMs(kind: HapticKind): number {
  const pattern = hapticPattern(kind);
  return Array.isArray(pattern) ? pattern.reduce((sum, part) => sum + part, 0) : pattern;
}
