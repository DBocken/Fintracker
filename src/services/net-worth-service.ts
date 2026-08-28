import { computeAnchoredBalance, pickBalanceAnchor } from "@/features/shared/domain/balance-calculations";
import type { Account } from "../types";
import { getAccounts } from "./account-service";
import { getTransactions } from "./transaction-service";
import { getPortfolios, getPortfolioSummary } from "./portfolio-service";
import { getDebts } from "./debt-service";
import { totalOutstandingDebt } from "@/lib/debt-totals";
import { getReceivables, getTotalReceivables } from "./receivable-service";
import { getManualAssets } from "./manual-asset-service";
import { istVeraltet, summeManuellerWerte } from "@/lib/manual-asset-types";
import { eurContribution } from "@/lib/portfolio-currency";
import type {
  AccountSource,
  DebtSource,
  ManualAssetSource,
  NetWorthBreakdown,
  PortfolioSource,
  ReceivableSource,
  UnconvertedInvestmentSource,
} from "@/lib/net-worth-types";

// Die Form liegt in `lib`, der Wert entsteht hier. Der Re-Export haelt jede
// bestehende Importstelle gueltig — ein Umzug, der 40 Dateien anfasst, ist
// nicht derselbe Vorgang wie ein Umzug, der eine anfasst.
export type {
  AccountSource,
  DebtSource,
  ManualAssetSource,
  NetWorthBreakdown,
  PortfolioSource,
  ReceivableSource,
  UnconvertedInvestmentSource,
};

/**
 * Kontosaldo aus dem Anker (Bank-Saldo oder Startsaldo) plus den Buchungen
 * NACH dessen Stichtag.
 *
 * Hier stand bis zur Anker-Korrektur eine zweite, eigene Implementierung
 * derselben Rechnung — mit demselben Fehler wie die im Dashboard: Sie
 * summierte ALLE Buchungen auf den Startsaldo, auch die, die bereits in ihm
 * steckten. Zwei Kopien einer Rechnung sind zwei Orte, an denen sie falsch
 * sein kann; deshalb ruft diese Datei jetzt die kanonische Fassung auf,
 * statt sie nachzubauen.
 */
const computeLocalBalance = computeAnchoredBalance;

/**
 * Aggregate net worth across accounts (cash), portfolios (investments) and debts.
 *
 * Account balances use live bank balances where available, otherwise fall back
 * to the sum of local transactions.
 */
export async function getNetWorthBreakdown(): Promise<NetWorthBreakdown> {
  const [accounts, transactions, debts, receivables, manualAssets] = await Promise.all([
    getAccounts(),
    getTransactions(10000),
    getDebts(),
    getReceivables(),
    getManualAssets(),
  ]);

  const accountBalances: Record<string, number> = {};
  const accountSources: AccountSource[] = [];
  let cash = 0;
  for (const acc of accounts as Account[]) {
    // Ein Bank-Saldo ist ein Anker, kein Endergebnis: Er wird nicht mehr
    // ungefiltert übernommen, sondern von `computeLocalBalance` mit den
    // Buchungen NACH seinem Stichtag fortgeschrieben. Vorher fror er ein —
    // jede spätere Buchung war im Nettovermögen unsichtbar.
    const anchor = pickBalanceAnchor(acc);
    const balance = computeLocalBalance(acc, transactions);
    accountBalances[acc.id] = balance;
    cash += balance;
    accountSources.push({
      id: acc.id,
      name: acc.name,
      balance,
      source: anchor?.source === "bank" ? "live" : "local",
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

  // Der Stichtag wird EINMAL genommen, nicht je Wert: Zwei Aufrufe von
  // `new Date()` in derselben Aufstellung könnten über Mitternacht
  // auseinanderfallen, und dann wäre derselbe Wert einmal frisch und einmal
  // veraltet.
  const jetzt = new Date();
  const totalManualAssets = summeManuellerWerte(manualAssets);
  const manualAssetSources: ManualAssetSource[] = manualAssets.map((a) => ({
    id: a.id,
    name: a.name,
    value: a.value,
    kind: a.kind,
    valuedAt: a.valued_at,
    stale: istVeraltet(a, jetzt),
  }));

  return {
    cash,
    investments,
    manualAssets: totalManualAssets,
    receivables: totalReceivables,
    debts: totalDebt,
    netWorth: cash + investments + totalManualAssets + totalReceivables - totalDebt,
    accountBalances,
    accountSources,
    portfolioSources,
    unconvertedInvestments,
    debtSources,
    receivableSources,
    manualAssetSources,
  };
}
