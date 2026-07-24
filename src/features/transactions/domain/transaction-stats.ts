import type { Category, Transaction, TransactionAllocation } from '@/types';
import { computeFlowTotals } from '@/features/shared/domain/flow-calculations';
import { isCategoryInFilter, sumCategoryFlow } from '@/lib/analysis-data';

/** Aufteilungs-Kontext für anteilsgenaue Kennzahlen bei aktivem Kategorie-Filter. */
export interface TransactionStatsSplits {
  /** transaction_id → Aufteilungen (`getAllocationMap`). */
  allocationsByTransaction: Map<string, TransactionAllocation[]>;
  /** Aktive Kategorie; `'all'` = keine Einschränkung. */
  categoryFilter: string;
  categories: Category[];
}

/**
 * Kennzahlen für die aktuell sichtbaren Buchungen (TransactionsPage Z.
 * 185–190): transferbereinigte Einnahmen/Ausgaben/Saldo über
 * `computeFlowTotals` (statt einer eigenen Reduce-Kette, siehe F-MONEY-3),
 * plus die Anzahl sichtbarer Buchungen.
 *
 * Mit aktivem Kategorie-Filter zählen aufgeteilte Buchungen nur mit ihrem
 * ANTEIL in dieser Kategorie (`sumCategoryFlow`): Eine auf Lebensmittel +
 * Kleidung aufgeteilte Aldi-Buchung steuert unter „Kleidung" nur den
 * Kleidungs-Anteil bei — sonst widerspräche die Kennzahlenleiste der Liste,
 * die genau diesen Anteil als eigene Zeile zeigt. `count` bleibt die Zahl der
 * sichtbaren BUCHUNGEN (nicht der Anteile).
 */
export function computeTransactionStats(
  visible: Transaction[],
  splits?: TransactionStatsSplits,
): {
  income: number;
  expenses: number;
  balance: number;
  count: number;
} {
  if (!splits || splits.categoryFilter === 'all') {
    return { ...computeFlowTotals(visible), count: visible.length };
  }

  const categoriesById = new Map(splits.categories.map((category) => [category.id, category]));
  const { income, expenses } = sumCategoryFlow(
    visible,
    splits.allocationsByTransaction,
    (assignedId) => isCategoryInFilter(assignedId, categoriesById, splits.categoryFilter),
  );
  return { income, expenses, balance: income - expenses, count: visible.length };
}
