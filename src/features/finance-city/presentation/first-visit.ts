/**
 * First-Visit-Tracking für den Signature Moment (WP-5.5).
 *
 * Erkennt, ob der Nutzer die Stadt zum ersten Mal besucht.
 * Nutzt localStorage mit graceful fallback bei blockiertem Storage
 * (z.B. Private Browsing) — dann wird der Moment bei jedem Besuch gezeigt
 * (besser zu oft als nie).
 */

const FIRST_VISIT_KEY = 'fintracker.city.first-visit-done';

/** True, wenn der Nutzer die Stadt noch nie besucht hat. */
export function isFirstVisit(): boolean {
  try {
    return window.localStorage.getItem(FIRST_VISIT_KEY) !== '1';
  } catch {
    return true; // Storage blockiert: Moment immer zeigen
  }
}

/** Markiert den ersten Besuch als abgeschlossen. */
export function markVisited(): void {
  try {
    window.localStorage.setItem(FIRST_VISIT_KEY, '1');
  } catch {
    // Storage blockiert: kein persistentes Flag möglich
  }
}
