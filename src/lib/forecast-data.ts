/**
 * Forecast Engine – Data Adapter (Stufe 1)
 *
 * Übersetzt die echten App-Datenquellen in die reine {@link ForecastInput}-
 * Struktur. Hier – und nur hier – findet IO statt; die Engine selbst
 * (`forecast.ts`) bleibt seiteneffektfrei und testbar.
 *
 * Grundsatz: auto-seeded. Der Forecast baut sich aus echten Konten,
 * wiederkehrenden Zahlungen und Transaktionen auf; manuelle Eingaben sind
 * spätere Overrides, keine Pflicht.
 */
import { subMonths } from 'date-fns';
import type { Account, AccountType, Transaction } from '@/types';
import type { ContractRow, Cycle } from '@/components/contracts/contract-types';
import { getAccounts } from '@/services/account-service';
import { getNetWorthBreakdown } from '@/services/net-worth-service';
import { detectRecurringTransactions } from '@/services/contract-detection-service';
import { getTransactions } from '@/services/transaction-service';
import {
  getForecastOverrides,
  type ForecastOverrides,
} from '@/services/forecast-overrides-service';
import type {
  ForecastAccount,
  ForecastAccountKind,
  ForecastInput,
  RecurringCadence,
  RecurringFlow,
  VariableExpenseBaseline,
} from './forecast-types';

/** Mappt die App-Kontoart auf die Forecast-Kontoart. */
export function accountTypeToKind(type: AccountType): ForecastAccountKind {
  switch (type) {
    case 'checking':
      return 'checking';
    case 'cash':
      return 'cash';
    case 'wallet':
      return 'wallet';
    case 'savings':
      return 'savings';
    case 'credit_card':
      return 'credit_card';
    default:
      return 'other';
  }
}

/** Mappt den erkannten Vertrags-Zyklus auf eine Forecast-Cadence. */
export function cycleToCadence(cycle: Cycle): RecurringCadence | null {
  switch (cycle) {
    case 'Wöchentlich':
      return 'weekly';
    case 'Monatlich':
      return 'monthly';
    case 'Vierteljährlich':
      return 'quarterly';
    case 'Halbjährlich':
      return 'semiannual';
    case 'Jährlich':
      return 'annual';
    default:
      return null; // Unbekannt -> nicht in den Forecast zwingen
  }
}

/**
 * Baut die Konten-Liste mit echten Startsalden. Salden kommen aus dem
 * Net-Worth-Service (live, sonst aus lokalen Transaktionen summiert).
 */
export function buildForecastAccounts(
  accounts: Account[],
  accountBalances: Record<string, number>,
): ForecastAccount[] {
  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    kind: accountTypeToKind(account.type),
    openingBalance: accountBalances[account.id] ?? (Number(account.opening_balance) || 0),
  }));
}

/**
 * Leitet wiederkehrende Flows aus den erkannten Verträgen ab. Verträge mit
 * unbekanntem Zyklus werden bewusst ausgelassen (keine Scheingenauigkeit).
 */
export function buildRecurringFlows(contracts: ContractRow[]): RecurringFlow[] {
  const flows: RecurringFlow[] = [];
  for (const contract of contracts) {
    if (contract.stale) continue; // vermutlich beendet
    const cadence = cycleToCadence(contract.cycle);
    if (!cadence) continue;
    const anchorDate = contract.nextDateISO ?? contract.lastDateISO;
    if (!anchorDate) continue;

    const magnitude = Math.abs(contract.amountTypical);
    const signed = contract.type === 'Einnahme' ? magnitude : -magnitude;
    flows.push({
      id: contract.key,
      name: contract.payee,
      amount: signed,
      cadence,
      anchorDate: anchorDate.slice(0, 10),
      accountId: '', // wird unten an ein operatives Konto gebunden
      category: contract.categoryName,
      confidence: contract.confirmed ? 1 : 0.6,
    });
  }
  return flows;
}

/**
 * Setzt das Standardkonto für Flows, die kein Konto tragen (Verträge führen
 * keine Konto-Zuordnung). Default: erstes Girokonto, sonst erstes Konto.
 */
function bindFlowsToDefaultAccount(
  flows: RecurringFlow[],
  accounts: ForecastAccount[],
): RecurringFlow[] {
  const defaultAccount =
    accounts.find((a) => a.kind === 'checking') ?? accounts[0];
  if (!defaultAccount) return flows;
  return flows.map((flow) => (flow.accountId ? flow : { ...flow, accountId: defaultAccount.id }));
}

/**
 * Leitet eine variable Ausgaben-Baseline je Kategorie aus der echten Historie
 * ab. Berücksichtigt nur *echte* Ausgaben: keine Transfers, keine als Vertrag
 * markierten Buchungen (die laufen als wiederkehrende Flows).
 *
 * Reine Funktion (kein IO) – damit unabhängig testbar.
 *
 * @param transactions Historische Transaktionen.
 * @param options.monthsBack Rückblickfenster in Monaten (Default 6).
 * @param options.now Referenzdatum (Default: jetzt).
 */
export function buildVariableExpenseBaselines(
  transactions: Transaction[],
  options: { monthsBack?: number; now?: Date } = {},
): VariableExpenseBaseline[] {
  const monthsBack = options.monthsBack ?? 6;
  const now = options.now ?? new Date();
  const windowStart = subMonths(now, monthsBack);

  const sums = new Map<string, number>();
  const monthsSeen = new Set<string>();

  for (const t of transactions) {
    if (t.is_transfer || t.is_contract) continue;
    if (t.amount >= 0) continue; // nur Ausgaben
    const date = new Date(t.date);
    if (Number.isNaN(date.getTime())) continue;
    if (date < windowStart || date > now) continue;

    const category = t.category?.trim() || 'Sonstiges';
    sums.set(category, (sums.get(category) ?? 0) + Math.abs(t.amount));
    monthsSeen.add(t.date.slice(0, 7));
  }

  const denom = Math.max(monthsSeen.size, 1);
  const confidence = monthsSeen.size >= 3 ? 0.75 : 0.5;

  const baselines: VariableExpenseBaseline[] = [];
  for (const [category, total] of sums) {
    const monthlyAmount = Math.round((total / denom) * 100) / 100;
    if (monthlyAmount <= 0) continue;
    baselines.push({ category, monthlyAmount, confidence });
  }
  // Größte Kategorien zuerst – stabil und gut für die UI.
  baselines.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
  return baselines;
}

/**
 * Wendet die nutzerseitigen Planungs-Overrides auf den auto-seeded Input an:
 * Tagesgeld-Zinssätze, Budget-Overrides je Kategorie, geplante Einmalposten
 * und Rücklagen. Reine Funktion (kein IO) – damit unabhängig testbar.
 */
export function applyForecastOverrides(
  input: ForecastInput,
  overrides: ForecastOverrides,
): ForecastInput {
  const accounts = input.accounts.map((a) =>
    overrides.accountInterest[a.id] != null
      ? { ...a, annualInterestRate: overrides.accountInterest[a.id] }
      : a,
  );

  const variableExpenses = (input.variableExpenses ?? []).map((b) =>
    overrides.categoryBudgets[b.category] != null
      ? { ...b, budgetOverride: overrides.categoryBudgets[b.category] }
      : b,
  );

  return {
    ...input,
    accounts,
    variableExpenses,
    plannedEvents: [...(input.plannedEvents ?? []), ...overrides.plannedEvents],
    sinkingFunds: [...(input.sinkingFunds ?? []), ...overrides.sinkingFunds],
  };
}

/**
 * Sammelt alle Eingaben für die Forecast-Engine aus den echten Services und
 * legt die nutzerseitigen Planungs-Overrides darüber.
 *
 * Auto-seeded: Konten (mit echten Salden), wiederkehrende Flows (aus der
 * Vertragserkennung) und die variable Ausgaben-Baseline (aus der Historie).
 * Overrides: Zinssätze, Budgets, geplante Events und Rücklagen.
 */
export async function buildForecastInput(): Promise<ForecastInput> {
  const [accounts, netWorth, contracts, transactions] = await Promise.all([
    getAccounts(),
    getNetWorthBreakdown(),
    detectRecurringTransactions(),
    getTransactions(2000),
  ]);

  const forecastAccounts = buildForecastAccounts(accounts, netWorth.accountBalances);
  const recurringFlows = bindFlowsToDefaultAccount(
    buildRecurringFlows(contracts),
    forecastAccounts,
  );
  const variableExpenses = buildVariableExpenseBaselines(transactions);

  const seeded: ForecastInput = {
    accounts: forecastAccounts,
    recurringFlows,
    variableExpenses,
  };

  return applyForecastOverrides(seeded, getForecastOverrides());
}
