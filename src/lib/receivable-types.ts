/**
 * Persistierte Formen rund um Forderungen (Geld, das jemand mir schuldet).
 *
 * Spiegelbild zu `src/lib/debt-types.ts`, aber als Aktivum. Domäne, nicht
 * Speicherung — der `receivable-service` speichert sie, besitzt die Form
 * aber nicht (AGENTS.md §3). Diese Datei ist Teil der Aufteilung von
 * `src/types.ts` (WP 5.2, DOM-3).
 */

/** Art der Forderung (verliehenes Geld, geteilte Ausgabe, Kaution, …). */
export type ReceivableType = 'private_loan' | 'shared_expense' | 'deposit' | 'other';

/**
 * Eine Forderung – Geld, das jemand mir schuldet (verliehenes Geld). Spiegelbild
 * zur {@link Debt}, aber als Aktivum und mit eingehenden Rückzahlungen.
 */
export interface Receivable {
  id: string;
  user_id: string;
  /** Bezeichnung, z. B. "Max – Konzertticket". */
  name: string;
  /** Name des Schuldners – Basis für das Matching eingehender Rückzahlungen. */
  debtor?: string | null;
  type: ReceivableType;
  /** Offener Restbetrag. */
  amount: number;
  /** Ursprünglich verliehener Betrag. */
  original_amount?: number | null;
  /** Bar verliehen (kein Bankbeleg). */
  is_cash: boolean;
  due_date?: string | null;
  notes?: string | null;
  /** Vollständig zurückgezahlt. */
  is_settled: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Verknüpft eine eingehende Buchung als (Teil-)Rückzahlung mit einer Forderung. */
export interface ReceivableTransactionAssignment {
  id: string;
  user_id: string;
  receivable_id: string;
  transaction_id: string;
  amount: number;
  created_at: string;
}
