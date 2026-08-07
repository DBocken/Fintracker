/**
 * Datenmodell des lokalen Haushalts-/Paarmodells für geteilte Ausgaben.
 *
 * Die Form gehört zur Domäne, das Speichern zum `household-service`. Zuvor lag
 * beides im Service, wodurch `features/household-settlement/domain/balances.ts`
 * entgegen der Schichtrichtung nach oben importieren musste (AGENTS.md §3).
 */

export interface Household {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  name: string;
  /** Optionaler Standard-Anteil (Gewicht) für Splits; Default gleichmäßig. */
  share?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SharedExpenseShare {
  member_id: string;
  amount: number;
}

export interface SharedExpenseSplit {
  id: string;
  transaction_id: string;
  household_id: string;
  shares: SharedExpenseShare[];
  /**
   * Wer die Ausgabe tatsächlich bezahlt hat (Ist-Zahler). Nur Splits mit
   * `paid_by_member_id` gehen in die Salden-/Ausgleichsberechnung ein (#247);
   * ohne diesen Wert ist der Split reine Kostenaufteilung ohne Schuldwirkung.
   */
  paid_by_member_id?: string;
  created_at?: string;
  updated_at?: string;
}
