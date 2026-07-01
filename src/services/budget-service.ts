import type { Budget, BudgetPeriod, BudgetStatus, BudgetSuggestion } from "@/types";
import {
  deleteLocalFinanceItem,
  readLocalFinanceList,
  upsertLocalFinanceItem,
  writeLocalFinanceList,
} from "./local-finance-store";
import { getCategories, getTransactions } from "./transaction-service";
import { getAllocationMap } from "./transaction-allocation-service";
import { computeBudgetStatus, monthKeyOf, periodKeyOf, suggestBudgets } from "@/lib/budget-logic";
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

/** ISO-Datum `YYYY-MM-DD` im lokalen Kalender (für perioden-genaue Schlüssel). */
function localIsoDate(reference: Date): string {
  return `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, "0")}-${String(
    reference.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Aktueller Perioden-Schlüssel je nach Budget-Periode: `YYYY` (jährlich),
 * `YYYY-Www` (wöchentlich) oder `YYYY-MM` (monatlich, Default).
 */
export function currentPeriodKey(period: BudgetPeriod = "monthly", reference: Date = new Date()): string {
  if (period === "yearly") return String(reference.getFullYear());
  if (period === "weekly") return periodKeyOf(localIsoDate(reference), "weekly");
  return currentMonthKey(reference);
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
    const period = budget.period ?? "monthly";
    // Nicht-monatliche Perioden (wöchentlich/jährlich) laufen über den klassischen,
    // perioden-genauen Pfad. Übertrag & adaptives Limit sind bewusst monatsbasiert
    // (Median/Kette in Monaten) und bleiben `monthly` vorbehalten.
    if (period !== "monthly") {
      return computeBudgetStatus(budget, transactions, categories, currentPeriodKey(period, reference), allocationsByTx);
    }
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
  // Nur für monatliche Budgets sinnvoll – die Baseline mittelt über Monate.
  for (const status of statuses) {
    if ((status.budget.period ?? "monthly") !== "monthly") continue;
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
