/**
 * Reine Übersetzung App-Daten → Forecast-Bausteine: Kontoart, Vertragszyklus,
 * Startsalden, wiederkehrende Zahlungen.
 *
 * Lag bis Welle 2 in `services/forecast-data.ts` — dort, wo es zuerst
 * gebraucht wurde. Kein I/O steckt darin, und mit dem Chat kam ein zweiter
 * Nutzer WEITER UNTEN dazu: Ein Registereintrag in einer Feature-`domain` darf
 * `src/services/` nicht importieren (`check:layers`), hätte die Ableitung
 * also nachbauen müssen — zwei Kopien einer Rechnung sind zwei Orte, an denen
 * sie falsch sein kann (AGENTS.md §3, „Wohin ein Typ gehört").
 *
 * Das I/O bleibt beim Dienst: `buildForecastInput` lädt Konten, Buchungen und
 * Salden und ruft diese Funktionen. Sie selbst sehen nur ihre Argumente.
 */
import type { Account, AccountType } from '@/types';
import type { ContractRow, Cycle } from '@/lib/contract-types';
import { isActiveForTotals } from '@/lib/contract-derivation';
import type {
  ForecastAccount,
  ForecastAccountKind,
  RecurringCadence,
  RecurringFlow,
} from '@/lib/forecast-types';

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
    // Ausgaben müssen bestätigt sein. Eine zuverlässig erkannte, aktuelle
    // Einnahmenserie darf dagegen schon als transparenter Vorschlag einfließen.
    const isSuggestedIncome =
      contract.type === 'Einnahme' &&
      contract.status === 'candidate' &&
      !contract.stale &&
      contract.cycleKnown;
    if (!isActiveForTotals(contract) && !isSuggestedIncome) continue;
    const cadence = cycleToCadence(contract.cycle);
    if (!cadence) continue;
    const anchorDate = contract.nextDateISO ?? contract.lastDateISO;
    if (!anchorDate) continue;

    const magnitude = Math.abs(contract.amountRecentTypical ?? contract.amountTypical);
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
      // WP-5.2: Die stabile ID lag hier schon vor und wurde verworfen —
      // Konsumenten mussten über den Anzeigenamen verknüpfen (AGENTS.md §6,
      // dokumentierte Falle). `categoryName` bleibt für Labels unverändert.
      categoryId: contract.categoryId ?? undefined,
      confidence: contract.confirmed ? 1 : 0.6,
      endDate: flowOverride?.endDate,
    });
  }
  return flows;
}
