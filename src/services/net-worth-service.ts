import type { Account, Transaction } from "../types";
import { getAccounts } from "./account-service";
import { getTransactions } from "./transaction-service";
import { getPortfolios, getPortfolioSummary } from "./portfolio-service";
import { getDebts, getTotalDebt } from "./debt-service";

export interface AccountSource {
  id: string;
  name: string;
  balance: number;
  /** "live" = Saldo direkt von der Bank, "local" = aus lokalen Transaktionen summiert */
  source: "live" | "local";
  lastSyncAt?: string | null;
}

export interface PortfolioSource {
  id: string;
  name: string;
  value: number;
  positionsCount: number;
}

export interface DebtSource {
  id: string;
  name: string;
  balance: number;
}

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
  /** Details on how each account's balance was determined */
  accountSources: AccountSource[];
  /** Details on each portfolio's contribution to investments */
  portfolioSources: PortfolioSource[];
  /** Details on each debt's contribution to total debt */
  debtSources: DebtSource[];
}

/**
 * Compute the local balance of an account: opening balance (if set) plus
 * the sum of its transactions. Without an opening balance, the result only
 * reflects the imported history and may not match the real bank balance.
 */
function computeLocalBalance(account: Account, transactions: Transaction[]): number {
  let sum = Number(account.opening_balance) || 0;
  for (const t of transactions) {
    if (t.account_id === account.id) sum += t.amount;
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
  const accountSources: AccountSource[] = [];
  let cash = 0;
  for (const acc of accounts as Account[]) {
    const hasLiveBalance = acc.live_balance_amount !== null && acc.live_balance_amount !== undefined;
    const balance = hasLiveBalance
      ? Number(acc.live_balance_amount) || 0
      : computeLocalBalance(acc, transactions);
    accountBalances[acc.id] = balance;
    cash += balance;
    accountSources.push({
      id: acc.id,
      name: acc.name,
      balance,
      source: hasLiveBalance ? "live" : "local",
      lastSyncAt: acc.live_balance_updated_at ?? null,
    });
  }

  // Investments
  let investments = 0;
  const portfolioSources: PortfolioSource[] = [];
  try {
    const portfolios = (await getPortfolios()).filter((p) => p.type !== "demo");
    for (const p of portfolios) {
      const summary = await getPortfolioSummary(p.id);
      investments += summary.total_value;
      portfolioSources.push({
        id: p.id,
        name: p.name,
        value: summary.total_value,
        positionsCount: summary.positions_count,
      });
    }
  } catch {
    investments = 0;
  }

  const totalDebt = getTotalDebt(debts);
  const debtSources: DebtSource[] = debts
    .filter((d) => !d.is_paid_off)
    .map((d) => ({ id: d.id, name: d.name, balance: Math.max(0, d.balance) }));

  return {
    cash,
    investments,
    debts: totalDebt,
    netWorth: cash + investments - totalDebt,
    accountBalances,
    accountSources,
    portfolioSources,
    debtSources,
  };
}
