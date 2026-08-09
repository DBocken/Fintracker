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

/**
 * Eine Bewegung der Steuerrücklage: + = zurückgelegt, − = Steuer gezahlt.
 * Quick-Actions im Steuer-Tank; keine Auto-Erkennung von Transfers (v1).
 *
 * (Aus `src/types.ts` übernommen, WP 5.2/DOM-3 — gehört fachlich zur
 * gleichen Steuer-Domäne wie {@link TaxYearProfile}.)
 */
export interface TaxReserveMovement {
  id: string;
  /** Buchungsdatum der Bewegung (YYYY-MM-DD). */
  date: string;
  amount: number;
  note?: string | null;
}

/**
 * Steuerrücklage je Veranlagungsjahr. Das ZIEL wird NIE persistiert, sondern
 * immer abgeleitet (Prozent × YTD-Betriebseinnahmen) — sonst driftet es.
 */
export interface TaxReserveState {
  /** Stabile ID `tax-reserve-<year>` (Upsert-Anker im lokalen Store). */
  id: string;
  user_id: string;
  year: number;
  movements: TaxReserveMovement[];
  /** Übersteuert tax_reserve_percent aus den Settings nur für dieses Jahr. */
  percent_override?: number | null;
  /** Konto, auf dem die Rücklage physisch liegt (nur Anzeige). */
  account_id?: string | null;
}
