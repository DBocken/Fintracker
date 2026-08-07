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
