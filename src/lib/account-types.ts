/**
 * Persistierte Form eines Kontos.
 *
 * Konten sind Domäne, nicht Darstellung und nicht Speicherung — der
 * `local-finance-store`/`account-service` speichert sie, besitzt die Form
 * aber nicht (AGENTS.md §3, „Wohin ein Typ gehört"). Diese Datei ist Teil der
 * Aufteilung von `src/types.ts` (WP 5.2, DOM-3).
 */

export type AccountType = 'checking' | 'credit_card' | 'savings' | 'wallet' | 'cash' | 'other';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  description?: string;
  /** IBAN des Kontos (für die Erkennung interner Überträge zwischen eigenen Konten) */
  iban?: string | null;
  color: string;
  icon: string;
  is_budget_pool_member: boolean;
  /** Geschäftskonto (Einzelunternehmer): Buchungen zählen in die EÜR. Fehlend ≙ privat. */
  is_business?: boolean;
  order_index: number;
  statement_close_day?: number | null;
  due_day?: number | null;
  autopay_account_id?: string | null;
  gocardless_account_id?: string | null;
  gocardless_requisition_id?: string | null;
  gocardless_institution_id?: string | null;
  gocardless_institution_name?: string | null;
  last_sync_at?: string | null;
  sync_enabled?: boolean;
  bank_connection_id?: string | null;
  live_balance_amount?: number | null;
  live_balance_currency?: string | null;
  live_balance_type?: string | null;
  live_balance_updated_at?: string | null;
  /** Saldo zu einem Stichtag, bevor lokale Transaktionen erfasst wurden */
  opening_balance?: number | null;
  opening_balance_date?: string | null;
  created_at?: string;
  updated_at?: string;
}
