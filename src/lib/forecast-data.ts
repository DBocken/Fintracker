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
import type { Account, AccountType } from '@/types';
import type { ContractRow, Cycle } from '@/components/contracts/contract-types';
import { getAccounts } from '@/services/account-service';
import { getNetWorthBreakdown } from '@/services/net-worth-service';
import { detectRecurringTransactions } from '@/services/contract-detection-service';
import type {
  ForecastAccount,
  ForecastAccountKind,
  ForecastInput,
  RecurringCadence,
  RecurringFlow,
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
 * Sammelt alle Eingaben für die Forecast-Engine aus den echten Services.
 *
 * PR1-Scope: Konten + wiederkehrende Flows. Variable Ausgaben-Baseline,
 * Transfers und geplante Events folgen, sobald die jeweiligen Adapter
 * angebunden werden.
 */
export async function buildForecastInput(): Promise<ForecastInput> {
  const [accounts, netWorth, contracts] = await Promise.all([
    getAccounts(),
    getNetWorthBreakdown(),
    detectRecurringTransactions(),
  ]);

  const forecastAccounts = buildForecastAccounts(accounts, netWorth.accountBalances);
  const recurringFlows = bindFlowsToDefaultAccount(
    buildRecurringFlows(contracts),
    forecastAccounts,
  );

  return {
    accounts: forecastAccounts,
    recurringFlows,
  };
}
