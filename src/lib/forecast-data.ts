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
import { addMonths, format, startOfMonth, subMonths } from 'date-fns';
import type { Account, AccountType, Category, Transaction } from '@/types';
import type { ContractRow, Cycle } from '@/components/contracts/contract-types';
import { getAccounts } from '@/services/account-service';
import { getNetWorthBreakdown } from '@/services/net-worth-service';
import { getCategories, getTransactions } from '@/services/transaction-service';
import { getContractDecisionMap } from '@/services/contract-decision-service';
import { computeContracts, isActiveForTotals } from '@/lib/contract-derivation';
import { merchantFingerprint } from '@/lib/merchant-fingerprint';
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
 * Anschließend werden nutzerseitige Overrides angewendet (aktivieren/deaktivieren,
 * Betrag, End-Datum).
 */
export function buildRecurringFlows(
  contracts: ContractRow[],
  overrides?: Record<string, { enabled?: boolean; amount?: number; endDate?: string }>,
): RecurringFlow[] {
  const flows: RecurringFlow[] = [];
  for (const contract of contracts) {
    if (!isActiveForTotals(contract)) continue;
    const cadence = cycleToCadence(contract.cycle);
    if (!cadence) continue;
    const anchorDate = contract.nextDateISO ?? contract.lastDateISO;
    if (!anchorDate) continue;

    const magnitude = Math.abs(contract.amountTypical);
    const signed = contract.type === 'Einnahme' ? magnitude : -magnitude;
    const flowOverride = overrides?.[contract.key];

    // Skip disabled flows
    if (flowOverride?.enabled === false) continue;

    flows.push({
      id: contract.key,
      name: contract.payee,
      amount: flowOverride?.amount ?? signed,
      cadence,
      anchorDate: anchorDate.slice(0, 10),
      accountId: '', // wird unten an ein operatives Konto gebunden
      category: contract.categoryName,
      confidence: contract.confirmed ? 1 : 0.6,
      endDate: flowOverride?.endDate,
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
  options: {
    monthsBack?: number;
    now?: Date;
    excludedFingerprints?: ReadonlySet<string>;
    categoryNames?: ReadonlyMap<string, string>;
  } = {},
): VariableExpenseBaseline[] {
  const monthsBack = options.monthsBack ?? 6;
  const now = options.now ?? new Date();
  const windowStart = startOfMonth(subMonths(now, Math.max(0, monthsBack - 1)));

  // Pro Kategorie die Ausgaben je Monat sammeln – Basis für Mittelwert *und*
  // Streuung (Variationskoeffizient).
  const perCategoryMonth = new Map<string, Map<string, number>>();
  let earliestIncludedMonth: string | null = null;

  for (const t of transactions) {
    if (t.is_transfer || t.is_contract) continue;
    if (options.excludedFingerprints?.has(merchantFingerprint(t))) continue;
    if (t.amount >= 0) continue; // nur Ausgaben
    const date = new Date(t.date);
    if (Number.isNaN(date.getTime())) continue;
    if (date < windowStart || date > now) continue;

    const category =
      t.category?.trim() ||
      (t.category_id ? options.categoryNames?.get(t.category_id) : undefined) ||
      'Sonstiges';
    const month = t.date.slice(0, 7);
    if (!earliestIncludedMonth || month < earliestIncludedMonth) earliestIncludedMonth = month;
    let byMonth = perCategoryMonth.get(category);
    if (!byMonth) {
      byMonth = new Map<string, number>();
      perCategoryMonth.set(category, byMonth);
    }
    byMonth.set(month, (byMonth.get(month) ?? 0) + Math.abs(t.amount));
  }

  const firstMonth = earliestIncludedMonth
    ? startOfMonth(new Date(`${earliestIncludedMonth}-01T12:00:00`))
    : startOfMonth(now);
  const lastMonth = startOfMonth(now);
  const monthKeys: string[] = [];
  for (let month = firstMonth; month <= lastMonth; month = addMonths(month, 1)) {
    monthKeys.push(format(month, 'yyyy-MM'));
  }
  const denom = Math.max(monthKeys.length, 1);
  const confidence = monthKeys.length >= 6 ? 0.9 : monthKeys.length >= 3 ? 0.75 : 0.5;

  const baselines: VariableExpenseBaseline[] = [];
  for (const [category, byMonth] of perCategoryMonth) {
    // Vektor über alle beobachteten Monate (0, wo nichts ausgegeben wurde).
    const values = monthKeys.map((mk) => byMonth.get(mk) ?? 0);
    const mean = values.reduce((s, v) => s + v, 0) / denom;
    const monthlyAmount = Math.round(mean * 100) / 100;
    if (monthlyAmount <= 0) continue;

    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / denom;
    const volatility = mean > 0 ? Math.round((Math.sqrt(variance) / mean) * 100) / 100 : 0;

    baselines.push({ category, monthlyAmount, confidence, volatility });
  }
  // Größte Kategorien zuerst – stabil und gut für die UI.
  baselines.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
  return baselines;
}

/**
 * Wendet die nutzerseitigen Planungs-Overrides auf den auto-seeded Input an:
 * Tagesgeld-Zinssätze, Budget-Overrides je Kategorie, geplante Einmalposten,
 * Rücklagen und Transfers. Reine Funktion (kein IO) – damit unabhängig testbar.
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
    transfers: [...(input.transfers ?? []), ...overrides.transfers],
  };
}

/**
 * Sammelt alle Eingaben für die Forecast-Engine aus den echten Services und
 * legt die nutzerseitigen Planungs-Overrides darüber.
 *
 * Auto-seeded: Konten (mit echten Salden), wiederkehrende Flows (aus der
 * Vertragserkennung) und die variable Ausgaben-Baseline (aus der Historie).
 * Overrides: Zinssätze, Budgets, geplante Events, Rücklagen, Transfers und
 * Anpassungen an erkannten wiederkehrenden Zahlungen (aktivieren/deaktivieren,
 * Betrag, End-Datum).
 */
export async function buildForecastInput(): Promise<ForecastInput> {
  const [accounts, netWorth, categories, decisions, transactions] = await Promise.all([
    getAccounts(),
    getNetWorthBreakdown(),
    getCategories(),
    getContractDecisionMap(),
    getTransactions(10000),
  ]);

  const overrides = getForecastOverrides();
  const forecastAccounts = buildForecastAccounts(accounts, netWorth.accountBalances);
  const categoryMap = new Map<string, Category>(categories.map((category) => [category.id, category]));
  const contracts = [
    ...computeContracts(transactions, categoryMap, 'Einnahme', { decisions }),
    ...computeContracts(transactions, categoryMap, 'Ausgabe', { decisions }),
  ];
  const activeContracts = contracts.filter(isActiveForTotals);
  const recurringFlows = bindFlowsToDefaultAccount(
    buildRecurringFlows(activeContracts, overrides.recurringFlowOverrides),
    forecastAccounts,
  );
  // Erkannte Vertragsfamilien, die explizit beendet/abgelehnt/pausiert/archiviert
  // wurden, sind keine zukünftigen variablen Ausgaben. Kandidaten bleiben bis
  // zur Bestätigung in der Baseline und werden nicht zugleich als Fixkosten geplant.
  const excludedFingerprints = new Set(
    contracts
      .filter((contract) => contract.status !== 'candidate')
      .map((contract) => contract.fingerprint),
  );
  const variableExpenses = buildVariableExpenseBaselines(transactions, {
    excludedFingerprints,
    categoryNames: new Map(categories.map((category) => [category.id, category.name])),
  });

  const seeded: ForecastInput = {
    accounts: forecastAccounts,
    recurringFlows,
    variableExpenses,
  };

  return applyForecastOverrides(seeded, overrides);
}
