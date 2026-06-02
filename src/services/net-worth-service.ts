"use client";

import type { Account, Transaction } from "../types";
import { getAccounts } from "./account-service";
import { getTransactions } from "./transaction-service";
import { getPortfolios, getPortfolioSummary } from "./portfolio-service";
import { getDebts, getTotalDebt } from "./debt-service";

export interface NetWorthBreakdown {
  /** Sum of all account balances (cash) */
  cash: number;
  /** Total value of all portfolios */
  investments: number;
  /** Total outstanding debt */
  debts: number;
  /** cash + investments - debts */
  netWorth: number;
  /** Per-account balances */
  accountBalances: Record<string, number>;
}

/**
 * Compute the local balance of an account by summing its transactions.
 */
function computeLocalBalance(accountId: string, transactions: Transaction[]): number {
  let sum = 0;
  for (const t of transactions) {
    if (t.account_id === accountId) sum += t.amount;
  }
  return sum;
}

/**
 * Aggregate net worth across accounts (cash), portfolios (investments) and debts.
 *
 * Account balances use live bank balances where available, otherwise fall back
 * to the sum of local transactions.
 */
export async function getNetWorthBreakdown(): Promise<NetWorthBreakdown> {
  const [accounts, transactions, debts] = await Promise.all([
    getAccounts(),
    getTransactions(10000),
    getDebts(),
  ]);

  const accountBalances: Record<string, number> = {};
  let cash = 0;
  for (const acc of accounts as Account[]) {
    const balance =
      acc.live_balance_amount !== null && acc.live_balance_amount !== undefined
        ? Number(acc.live_balance_amount) || 0
        : computeLocalBalance(acc.id, transactions);
    accountBalances[acc.id] = balance;
    cash += balance;
  }

  // Investments
  let investments = 0;
  try {
    const portfolios = await getPortfolios();
    for (const p of portfolios) {
      const summary = await getPortfolioSummary(p.id);
      investments += summary.total_value;
    }
  } catch {
    investments = 0;
  }

  const totalDebt = getTotalDebt(debts);

  return {
    cash,
    investments,
    debts: totalDebt,
    netWorth: cash + investments - totalDebt,
    accountBalances,
  };
}
