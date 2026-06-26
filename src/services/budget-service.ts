import type { Budget, BudgetStatus, BudgetSuggestion } from "@/types";
import {
  deleteLocalFinanceItem,
  readLocalFinanceList,
  upsertLocalFinanceItem,
  writeLocalFinanceList,
} from "./local-finance-store";
import { getCategories, getTransactions } from "./transaction-service";
import { getAllocationMap } from "./transaction-allocation-service";
import { computeBudgetStatus, monthKeyOf, suggestBudgets } from "@/lib/budget-logic";

const KEY = "budgets" as const;

export async function getBudgets(): Promise<Budget[]> {
  const budgets = await readLocalFinanceList<Budget>(KEY);
  return budgets.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
}

export async function saveBudget(budget: Partial<Budget>): Promise<Budget> {
  if (!budget.category_id) throw new Error("Budget braucht eine Kategorie");
  if (!Number.isFinite(budget.limit) || (budget.limit ?? 0) <= 0) {
    throw new Error("Budget braucht ein Limit größer 0");
  }
  return upsertLocalFinanceItem<Budget>(KEY, budget as Budget);
}

export async function deleteBudget(id: string): Promise<void> {
  return deleteLocalFinanceItem<Budget>(KEY, id);
}

export async function replaceBudgets(budgets: Budget[]): Promise<void> {
  return writeLocalFinanceList<Budget>(KEY, budgets);
}

/** Aktueller Monatsschlüssel (`YYYY-MM`) im lokalen Kalender. */
export function currentMonthKey(reference: Date = new Date()): string {
  return `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, "0")}`;
}

export interface BudgetOverview {
  statuses: BudgetStatus[];
  suggestions: BudgetSuggestion[];
  month: string;
}

/**
 * Lädt alles, was die Budget-Seite braucht: Live-Stände der gespeicherten
 * Budgets plus Vorschläge für noch nicht budgetierte Hauptkategorien.
 */
export async function getBudgetOverview(reference: Date = new Date()): Promise<BudgetOverview> {
  const month = currentMonthKey(reference);
  const [budgets, categories, transactions, allocationsByTx] = await Promise.all([
    getBudgets(),
    getCategories(),
    getTransactions(5000),
    getAllocationMap(),
  ]);

  const statuses = budgets.map((budget) =>
    computeBudgetStatus(budget, transactions, categories, month, allocationsByTx),
  );

  const budgetedMainIds = new Set(budgets.map((b) => b.category_id));
  const suggestions = suggestBudgets(
    categories,
    transactions,
    { currentMonth: month, windowMonths: 3, excludeCategoryIds: budgetedMainIds },
    allocationsByTx,
  );

  return { statuses, suggestions, month };
}

/** Re-Export, damit Konsumenten nicht zusätzlich aus der Logik-Lib importieren müssen. */
export { monthKeyOf };
