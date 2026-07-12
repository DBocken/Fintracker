import type { Transaction } from '@/types';
import { sumIncome, sumExpenses } from '@/lib/analysis-data';

/**
 * Transferbereinigte Einnahmen/Ausgaben/Saldo über `sumIncome`/`sumExpenses`
 * (analysis-data.ts) — keine eigene Reduce-Kette, um Duplikate wie im
 * bisherigen Dashboard.tsx (F-MONEY-3) zu vermeiden.
 */
export function computeFlowTotals(visibleTransactions: Transaction[]): {
  income: number;
  expenses: number;
  balance: number;
} {
  const income = sumIncome(visibleTransactions);
  const expenses = sumExpenses(visibleTransactions);
  return { income, expenses, balance: income - expenses };
}
