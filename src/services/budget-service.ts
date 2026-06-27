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
import { computeBudgetStatusWithRollover, resolveRolloverConfig } from "@/lib/budget-rollover";
import { buildAdaptiveBaseLimit, computeAdaptiveBaseline, computeBudgetDrift } from "@/lib/budget-adaptive";

const KEY = "budgets" as const;

/** Wie viele Monate die Rollover-Kette zurückrechnet, um den Übertrag aufzubauen. */
const ROLLOVER_LOOKBACK = 12;

/** Liefert die letzten `n` Monatsschlüssel bis einschließlich `month`, chronologisch. */
export function lastNMonths(month: string, n: number): string[] {
  const [yStr, mStr] = month.split("-");
  let year = Number(yStr);
  let mon = Number(mStr);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(`${year}-${String(mon).padStart(2, "0")}`);
    mon -= 1;
    if (mon === 0) {
      mon = 12;
      year -= 1;
    }
  }
  return out.reverse();
}

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

  const statuses = budgets.map((budget) => {
    const usesRollover = resolveRolloverConfig(budget).mode !== "off";
    // Schneller Pfad für klassische Budgets ohne Übertrag/Adaptiv – Verhalten unverändert.
    if (!usesRollover && !budget.adaptive) {
      return computeBudgetStatus(budget, transactions, categories, month, allocationsByTx);
    }
    const months = lastNMonths(month, ROLLOVER_LOOKBACK);
    const baseLimitFor = budget.adaptive
      ? buildAdaptiveBaseLimit(budget, transactions, categories, undefined, allocationsByTx)
      : undefined;
    return computeBudgetStatusWithRollover(budget, transactions, categories, months, allocationsByTx, {
      baseLimitFor,
    });
  });

  // Auto-Retune-Hinweis: realer Median vs. gesetztes Limit (für „Limit anpassen?").
  for (const status of statuses) {
    const baseline = computeAdaptiveBaseline(status.budget, transactions, categories, {
      currentMonth: month,
      windowMonths: 6,
      seasonality: false,
    }, allocationsByTx);
    if (baseline.monthsOfData >= 2) {
      status.drift = computeBudgetDrift(status.budget.limit, baseline.median);
    }
  }

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
