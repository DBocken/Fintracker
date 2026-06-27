// Speist die „Finanz-Fundament"-Engine aus echten Daten:
// liquider Puffer + Sparquote aus dem Financial-Health-Service, Konsumschulden
// aus dem Debt-Service, Monatsausgaben als Median der letzten Monate.

import type { FoundationResult } from "@/lib/finance-foundation";
import { computeFinanceFoundation } from "@/lib/finance-foundation";
import { median } from "@/lib/budget-adaptive";
import { monthKeyOf } from "@/lib/budget-logic";
import { currentMonthKey, lastNMonths } from "./budget-service";
import { getFinancialHealth } from "./financial-health-service";
import { getDebts } from "./debt-service";
import { getTransactions } from "./transaction-service";

const WINDOW_MONTHS = 6;

/** Median der Monatsausgaben (|Ausgaben| ohne Transfers) über das Fenster. */
function medianMonthlyExpenses(
  transactions: Awaited<ReturnType<typeof getTransactions>>,
  reference: Date,
): number {
  const months = new Set(lastNMonths(currentMonthKey(reference), WINDOW_MONTHS));
  const byMonth = new Map<string, number>();
  for (const t of transactions) {
    if (t.is_transfer || t.amount >= 0) continue;
    const mk = monthKeyOf(t.date);
    if (!months.has(mk)) continue;
    byMonth.set(mk, (byMonth.get(mk) ?? 0) + Math.abs(t.amount));
  }
  return median([...byMonth.values()].filter((v) => v > 0));
}

export async function getFinanceFoundation(reference: Date = new Date()): Promise<FoundationResult> {
  const [health, debts, transactions] = await Promise.all([
    getFinancialHealth(),
    getDebts(),
    getTransactions(5000),
  ]);

  // Konsumschulden = alle offenen Schulden außer Immobilienkrediten.
  const consumerDebt = debts
    .filter((d) => !d.is_paid_off && d.type !== "mortgage")
    .reduce((sum, d) => sum + Math.max(0, d.balance), 0);

  return computeFinanceFoundation({
    liquidBuffer: Math.max(0, health.netWorth.cash),
    monthlyExpenses: medianMonthlyExpenses(transactions, reference),
    consumerDebt,
    savingsRate: health.savingsRate,
    goalsFunded: 0,
  });
}
