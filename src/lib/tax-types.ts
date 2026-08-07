/**
 * Fachliche Typen der Steuer-Auswertung.
 *
 * `TaxYearProfile` beschreibt die Form der jahresbezogenen Angaben (km,
 * Arbeitstage, Homeoffice-Tage) — gespeichert wird sie vom
 * `tax-profile-service`, gebraucht wird sie von der reinen Berechnung in
 * `lib/tax-report.ts`. Der Typ gehört deshalb in die Domänenschicht, nicht in
 * den I/O-Service (AGENTS.md §3).
 */

export interface TaxYearProfile {
  id: string;
  year: number;
  /** Arbeitstage mit Arbeitsweg (für die Entfernungspauschale). */
  commuteDaysPerYear?: number | null;
  /** Einfache Entfernung Wohnung–Arbeit in km. */
  commuteOneWayKm?: number | null;
  /** Anzahl Homeoffice-Tage (für die Homeoffice-Pauschale). */
  homeofficeDays?: number | null;
  created_at?: string;
  updated_at?: string;
}
