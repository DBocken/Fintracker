/**
 * WP-5.4 — Fensteraktivität als Datenkanal.
 *
 * Das Fenster-Raster der Fassade (WP-E1, `FACADE_WINDOW_ALPHA`) war reine
 * Dekoration: EINE geteilte Textur auf allen Baukörpern, überall gleich viele
 * Fenster. Ein Gebäude sah belebt aus, weil es ein Gebäude ist — nicht, weil
 * dort etwas passiert.
 *
 * Damit lag ein Kanal brach, der etwas zeigen kann, das die HÖHE
 * grundsätzlich nicht kann: ob ein Betrag aus EINER großen Zahlung besteht
 * oder aus vielen kleinen. Miete und Restaurantbesuche können denselben
 * Monatsbetrag haben und sind völlig verschiedene Dinge — das eine ist ein
 * Dauerauftrag, das andere sind dreißig Entscheidungen.
 *
 * Maß ist deshalb die Buchungs-FREQUENZ, nicht die Buchungszahl: absolute
 * Zahlen hingen am geladenen Datenfenster (wer zwei Jahre importiert, hätte
 * überall „viel Aktivität"). Buchungen pro Monat ist stabil und im Klartext
 * lesbar: „hier passiert etwa einmal die Woche etwas".
 *
 * Rein und browserfrei (README-Architekturtabelle, `domain/`).
 */

/** Stufen von ruhig nach belebt — die Reihenfolge ist Teil des Vertrags (Textur-Auswahl in `city-scene.ts`). */
export const ACTIVITY_LEVELS = ['quiet', 'steady', 'busy'] as const;

export type CityActivityLevel = (typeof ACTIVITY_LEVELS)[number];

/**
 * Untergrenzen in Buchungen pro Monat.
 *
 * - `quiet` (< 1/Monat): Miete, Versicherung, Abos — eine Zahlung, fertig.
 * - `steady` (1–4/Monat): Lebensmittel-Großeinkauf, Tanken.
 * - `busy` (> 4/Monat): alles, was mehrmals die Woche passiert.
 *
 * Bewusst grob: drei Stufen sind auf einer Fassade aus 30 m Entfernung
 * unterscheidbar, fünf wären es nicht. Wer die genaue Zahl braucht, taucht in
 * die Etagen ein.
 */
const LEVEL_THRESHOLDS: Record<CityActivityLevel, number> = {
  quiet: 0,
  steady: 1,
  busy: 4,
};

/**
 * Aktivitätsstufe eines Gebäudes aus Buchungszahl und Länge des Datenfensters.
 *
 * `monthsInWindow` ist die Zahl der Kalendermonate, über die überhaupt Daten
 * vorliegen — NICHT die Monate, in denen dieses Gebäude gebucht hat. Sonst
 * käme ein Gebäude mit einer einzigen Buchung in einem einzigen Monat auf
 * „1 Buchung / 1 Monat" und damit auf dieselbe Stufe wie ein echtes
 * monatliches Abo.
 */
export function activityLevel(bookingCount: number, monthsInWindow: number): CityActivityLevel {
  if (!Number.isFinite(bookingCount) || bookingCount <= 0) return 'quiet';
  const months = Number.isFinite(monthsInWindow) && monthsInWindow > 0 ? monthsInWindow : 1;
  const perMonth = bookingCount / months;

  // Von oben nach unten: die erste Stufe, deren Schwelle erreicht ist.
  for (let index = ACTIVITY_LEVELS.length - 1; index > 0; index -= 1) {
    const level = ACTIVITY_LEVELS[index];
    if (perMonth >= LEVEL_THRESHOLDS[level]) return level;
  }
  return 'quiet';
}
