import type { Account, Transaction } from "../types";
import { getAccounts } from "./account-service";
import { getTransactions } from "./transaction-service";
import { getPortfolios, getPortfolioSummary } from "./portfolio-service";
import { getDebts } from "./debt-service";
import { totalOutstandingDebt } from "@/lib/debt-totals";
import { getReceivables, getTotalReceivables } from "./receivable-service";
import { eurContribution } from "@/lib/portfolio-currency";

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
  /** Euro-Anteil des Depots — Fremdwährung ist hier bewusst nicht enthalten. */
  value: number;
  /** Anzahl der Positionen hinter `value` (ohne die nicht verrechneten). */
  positionsCount: number;
}

/**
 * Ein Bestand, der BEWUSST nicht ins Nettovermögen einfließt, weil er nicht in
 * Euro notiert (VE-1, `docs/architecture/currency-eur-only.md`). Je Depot und
 * Währung ein Eintrag.
 */
export interface UnconvertedInvestmentSource {
  /** `<portfolioId>:<currency>` — ein Depot kann mehrere Fremdwährungen halten. */
  id: string;
  /** Name des Depots, aus dem der Bestand stammt. */
  name: string;
  currency: string;
  /** Marktwert in `currency` — Anzeige, nie Summand. */
  value: number;
  positionsCount: number;
}

export interface DebtSource {
  id: string;
  name: string;
  balance: number;
}

export interface ReceivableSource {
  id: string;
  name: string;
  amount: number;
}

export interface NetWorthBreakdown {
  /** Sum of all account balances (cash) */
  cash: number;
  /** Total value of all portfolios */
  investments: number;
  /** Total outstanding money lent out (receivables) */
  receivables: number;
  /** Total outstanding debt */
  debts: number;
  /** cash + investments + receivables - debts */
  netWorth: number;
  /** Per-account balances */
  accountBalances: Record<string, number>;
  /** Details on how each account's balance was determined */
  accountSources: AccountSource[];
  /** Details on each portfolio's contribution to investments */
  portfolioSources: PortfolioSource[];
  /**
   * Fremdwährungsbestände, die NICHT in `investments` und damit nicht in
   * `netWorth` stecken (VE-1). Leer, solange alles in Euro notiert.
   */
  unconvertedInvestments: UnconvertedInvestmentSource[];
  /** Details on each debt's contribution to total debt */
  debtSources: DebtSource[];
  /** Details on each receivable's contribution to total receivables */
  receivableSources: ReceivableSource[];
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
  const [accounts, transactions, debts, receivables] = await Promise.all([
    getAccounts(),
    getTransactions(10000),
    getDebts(),
    getReceivables(),
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
  //
  // VE-1 (docs/architecture/currency-eur-only.md): Das Nettovermögen ist ein
  // Euro-Betrag. Bis WP 7.7 wanderte `summary.total_value` unverändert hierher
  // — ein USD-Depot erhöhte damit das Euro-Vermögen 1:1, ohne dass irgendwo
  // etwas davon zu sehen war (F-DEBT-2). Was nicht in Euro notiert, zählt
  // nicht mit und wird stattdessen in `unconvertedInvestments` benannt.
  let investments = 0;
  const portfolioSources: PortfolioSource[] = [];
  const unconvertedInvestments: UnconvertedInvestmentSource[] = [];
  try {
    const portfolios = (await getPortfolios()).filter((p) => p.type !== "demo");
    for (const p of portfolios) {
      const summary = await getPortfolioSummary(p.id);
      const { eurValue, eurPositionsCount, unconverted } = eurContribution(summary);

      // Ein Depot ohne jeden Euro-Anteil steht NICHT in der Aufstellung der
      // Investitionen — es trägt nichts bei, und eine Zeile mit „0 €" wäre die
      // dritte Falschaussage. Ein leeres Depot bleibt dagegen sichtbar: Es ist
      // angelegt, nur noch nicht gefüllt.
      if (eurPositionsCount > 0 || unconverted.length === 0) {
        investments += eurValue;
        portfolioSources.push({
          id: p.id,
          name: p.name,
          value: eurValue,
          positionsCount: eurPositionsCount,
        });
      }

      for (const holding of unconverted) {
        unconvertedInvestments.push({
          id: `${p.id}:${holding.currency}`,
          name: p.name,
          currency: holding.currency,
          value: holding.value,
          positionsCount: holding.positionsCount,
        });
      }
    }
  } catch {
    investments = 0;
    portfolioSources.length = 0;
    unconvertedInvestments.length = 0;
  }

  const totalDebt = totalOutstandingDebt(debts);
  const debtSources: DebtSource[] = debts
    .filter((d) => !d.is_paid_off)
    .map((d) => ({ id: d.id, name: d.name, balance: Math.max(0, d.balance) }));

  const totalReceivables = getTotalReceivables(receivables);
  const receivableSources: ReceivableSource[] = receivables
    .filter((r) => !r.is_settled)
    .map((r) => ({ id: r.id, name: r.name, amount: Math.max(0, r.amount) }));

  return {
    cash,
    investments,
    receivables: totalReceivables,
    debts: totalDebt,
    netWorth: cash + investments + totalReceivables - totalDebt,
    accountBalances,
    accountSources,
    portfolioSources,
    unconvertedInvestments,
    debtSources,
    receivableSources,
  };
}
