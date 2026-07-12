import type { Transaction } from '@/types';
import { computeFlowTotals } from '@/features/shared/domain/flow-calculations';

/**
 * Kennzahlen für die aktuell sichtbaren Buchungen (TransactionsPage Z.
 * 185–190): transferbereinigte Einnahmen/Ausgaben/Saldo über
 * `computeFlowTotals` (statt einer eigenen Reduce-Kette, siehe F-MONEY-3),
 * plus die Anzahl sichtbarer Buchungen.
 */
export function computeTransactionStats(visible: Transaction[]): {
  income: number;
  expenses: number;
  balance: number;
  count: number;
} {
  return { ...computeFlowTotals(visible), count: visible.length };
}
