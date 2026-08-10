/**
 * Persistierte Formen rund um Schulden.
 *
 * Die Zuordnung einer Buchung zu einer Schuld ist Domäne; gespeichert wird sie
 * vom `debt-service`. Der Typ liegt hier, damit die reine Auswertung ihn
 * benutzen kann, ohne entgegen der Schichtrichtung nach oben zu greifen
 * (AGENTS.md §3).
 */

/** Eine Buchung, die der Nutzer einer Schuld als Tilgung zugeordnet hat. */
export interface DebtTransactionAssignment {
  id: string;
  user_id: string;
  debt_id: string;
  transaction_id: string;
  /** Betrag in Euro, wie er aus der Buchung übernommen wurde. */
  amount: number;
  created_at: string;
}

// --- Aus src/types.ts übernommen (WP 5.2/DOM-3) — gleiche Schulden-Domäne ---

export type DebtType = 'credit_card' | 'bnpl' | 'installment' | 'overdraft' | 'private_loan' | 'car_loan' | 'student_loan' | 'mortgage' | 'other';

/** Existenzsichernde Rückstände (Miete, Energie, Unterhalt) gehen im Plan immer vor Konsumschulden (#51). */
export type DebtPriority = 'existenzsichernd' | 'normal';

export interface Debt {
  id: string;
  user_id: string;
  name: string;
  type: DebtType;
  balance: number;
  original_amount?: number | null;
  interest_rate: number;
  min_payment: number;
  due_day?: number | null;
  due_date?: string | null;
  is_bnpl: boolean;
  provider?: string | null;
  notes?: string | null;
  is_paid_off: boolean;
  priority?: DebtPriority | null;
  created_at?: string;
  updated_at?: string;
}
