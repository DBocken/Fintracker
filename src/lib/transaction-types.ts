/**
 * Persistierte Formen rund um Buchungen (Transaktion, Split-Aufteilung).
 *
 * Buchungen sind Domäne, nicht Darstellung und nicht Speicherung — der
 * `local-finance-store`/`transaction-service` speichert sie, besitzt die Form
 * aber nicht (AGENTS.md §3). Diese Datei ist Teil der Aufteilung von
 * `src/types.ts` (WP 5.2, DOM-3).
 */

export interface Transaction {
  id?: string;
  account_id?: string | null;
  date: string;
  amount: number;
  payee: string;
  description: string;
  original_text: string;
  currency?: string;
  csvCategoryName?: string;
  category?: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  auto_mapped: boolean;
  confirmed: boolean;
  /** Markiert diese Transaktion als internen Übertrag zwischen eigenen Konten */
  is_transfer?: boolean;
  /** ID der verknüpften Gegenbuchung auf dem anderen Konto */
  transfer_pair_id?: string | null;
  /** IBAN des Gegenübers (Sender/Empfänger) – Basis für die automatische Transfer-Erkennung */
  counterparty_iban?: string | null;
  /** Ob diese Transaktion ein erkannter oder manueller Vertrag ist */
  is_contract?: boolean;
  /** Zyklus des Vertrags (weekly, monthly, etc.) */
  contract_cycle?: Rhythmus | null;
  /** Steuer-Rubrik dieser Buchung (stabile ID aus tax-catalog.ts). null/undefined = nicht steuerrelevant. */
  tax_category_id?: string | null;
  /** Arbeits-/Fahrtkostenanteil in EUR (positiv, ≤ |amount|) für §35a Abs. 3 – nur dieser Anteil ist begünstigt. */
  tax_labor_costs?: number | null;
  /** Kurznotiz für die Steuererklärung (z. B. Rechnungsnummer, Zahlungsweg). */
  tax_note?: string | null;
  /**
   * Explizit privat trotz Geschäftskonto (EÜR-Exklusion). Gewinnt gegen ein
   * gesetztes EÜR-`tax_category_id` (Konflikt ⇒ Warnung im EÜR-Report).
   */
  euer_private?: boolean;
}

export type Rhythmus = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/** Herkunft einer Transaktionsaufteilung. */
export type AllocationSource = 'manual' | 'receipt' | 'trackerverse';

/**
 * Aufteilung einer Transaktion auf mehrere Kategorien (Split-Buchung).
 *
 * Beträge in Cent (Integer, gleiches Vorzeichen wie `Transaction.amount`).
 * Aufteilungen sind kontoneutral: der Kontostand nutzt ausschließlich den
 * Originalbetrag der Transaktion – Aufteilungen erzeugen keine zusätzlichen
 * kontowirksamen Buchungen. Kategorie-Analysen verwenden Aufteilungen, sofern
 * vorhanden, sonst die Kategorie der Transaktion selbst. Die Summe aller
 * Aufteilungen entspricht exakt dem Betrag der Originalbuchung (cent-genau).
 */
export interface TransactionAllocation {
  id: string;
  transaction_id: string;
  /**
   * Teilbetrag in Cent (Integer). WP 5.1 (DOM-1) hat geprüft, ob dieses Feld
   * auf `Cents` (`@/lib/money`) gebrandet werden kann: Es kompiliert, bricht
   * aber `tsc --noEmit` in 3 Testdateien (23 Fundstellen — rohe
   * `amount_minor: <Zahl>`-Objektliterale in
   * `services/__tests__/transaction-allocation-service.test.ts`,
   * `lib/__tests__/analysis-data.test.ts`,
   * `features/shared/domain/__tests__/dashboard-filtering.test.ts`), die laut
   * WP-5.1-Vorgabe (docs/qualitaet-2026-08/plan.md) nicht angepasst werden
   * dürfen, um grün zu werden. Deshalb bewusst UNGEBRANDET gelassen —
   * Umstellung ist ein eigener Folgeschritt mit expliziter Test-Migration,
   * kein Nebeneffekt von WP 5.1.
   */
  amount_minor: number;
  category_id: string | null;
  subcategory_id?: string | null;
  label?: string | null;
  source: AllocationSource;
  /** Herkunfts-ID bei automatischen Quellen (Beleg-Zeile, Trackerverse-Event). */
  external_origin_id?: string | null;
  created_at?: string;
  updated_at?: string;
}
