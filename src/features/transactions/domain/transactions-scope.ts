import type { Account, Transaction } from '@/types';
import type { EffectiveBalance } from '@/features/shared/domain/balance-calculations';
import type { DashboardFilterState } from '@/features/shared/domain/dashboard-filters';

/**
 * Konto-Scope wie in TransactionsPage (Z. 172–179): 'all' zeigt alles,
 * 'budget-pool' nur Buchungen auf Budget-Pool-Konten, sonst ein konkretes
 * Konto (`scope` = `account_id`).
 */
export function isInAccountScope(tx: Transaction, accountsById: Map<string, Account>, scope: string): boolean {
  if (scope === 'all') return true;
  if (scope === 'budget-pool') {
    return !!tx.account_id && accountsById.get(tx.account_id)?.is_budget_pool_member === true;
  }
  return tx.account_id === scope;
}

/**
 * Aktueller Saldo im gewählten Scope (TransactionsPage Z. 135–145): Summe
 * der effektiven Salden über alle Konten, nur über Budget-Pool-Konten, oder
 * der Saldo eines einzelnen Kontos. Unbekannte `scope`-IDs liefern 0.
 */
export function computeScopedBalance(
  accounts: Account[],
  effectiveBalances: Record<string, EffectiveBalance>,
  scope: string,
): number {
  if (scope === 'all') {
    return accounts.reduce((sum, a) => sum + (effectiveBalances[a.id]?.amount ?? 0), 0);
  }
  if (scope === 'budget-pool') {
    return accounts
      .filter((a) => a.is_budget_pool_member)
      .reduce((sum, a) => sum + (effectiveBalances[a.id]?.amount ?? 0), 0);
  }
  return effectiveBalances[scope]?.amount ?? 0;
}

/**
 * Anker für den rückwärts abgeleiteten Tages-Kontostand (TransactionsPage
 * Z. 169–183): heutiger Scoped-Saldo minus alle Scope-Buchungen NACH dem
 * jüngsten sichtbaren Tag (relevant bei aktivem Zeitfilter). `visible` muss
 * datum-absteigend sortiert sein (Service-Contract der Storage-Schicht) —
 * `visible[0]` ist dann der neueste sichtbare Eintrag; ohne sichtbare
 * Buchungen gibt es keinen Anker-Zeitpunkt und der Scoped-Saldo wird direkt
 * zurückgegeben.
 *
 * ACHTUNG: Der Datumsvergleich ist ein ISO-STRING-Vergleich (`tx.date >
 * newest`), bewusst NICHT auf Date-Objekte umgestellt — identisches
 * Verhalten zur Page (funktioniert nur, weil `date` als `YYYY-MM-DD`
 * lexikografisch sortierbar ist).
 */
export function computeEndingBalanceAnchor(params: {
  /** Datum-absteigend sortiert; visible[0] = neuester sichtbarer Eintrag. */
  visible: Transaction[];
  all: Transaction[];
  accountsById: Map<string, Account>;
  scope: string;
  scopedCurrentBalance: number;
}): number {
  const { visible, all, accountsById, scope, scopedCurrentBalance } = params;
  const newest = visible[0]?.date;
  if (!newest) return scopedCurrentBalance;
  const sumAfter = all
    .filter((tx) => isInAccountScope(tx, accountsById, scope) && tx.date > newest)
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);
  return scopedCurrentBalance - sumAfter;
}

/**
 * Default-Werte wie `DEFAULT_DASHBOARD_FILTERS` in
 * `src/components/dashboard/filter-constants.ts` — bewusst hier als Literale
 * dupliziert statt zur Laufzeit importiert: `src/components/` ist UI-Schicht
 * (AGENTS.md §3), die Domain-Schicht darf davon nur Typen beziehen, keine
 * Laufzeit-Werte. Ein `[REGRESSION]`-Test in
 * `__tests__/transactions-scope.test.ts` importiert die kanonische Konstante
 * (dort erlaubt) und hält diese Literale synchron.
 */
const CONTENT_FILTER_DEFAULT = 'all';

/**
 * Ob mindestens ein INHALTS-Filter aktiv ist (TransactionsPage Z. 160–165).
 * `range` und `account` zählen bewusst NICHT: ein reiner Konto- oder
 * Zeitraum-Filter verändert nicht, welche Buchungen zu einer echten
 * Kontobewegung gehören — nur welcher Ausschnitt sichtbar ist. Der rückwärts
 * abgeleitete Laufsaldo-Header (`computeEndingBalanceAnchor`) bleibt dafür
 * gültig und wird nur bei Inhalts-Filtern ausgeblendet.
 */
export function hasContentFilter(filters: DashboardFilterState): boolean {
  return (
    filters.category !== CONTENT_FILTER_DEFAULT ||
    filters.contract !== CONTENT_FILTER_DEFAULT ||
    filters.essential !== CONTENT_FILTER_DEFAULT ||
    filters.ausgabenklasse !== CONTENT_FILTER_DEFAULT ||
    filters.search.trim() !== ''
  );
}

/**
 * Zahl aktiver Filter-Dimensionen (TransactionsPage Z. 192–202): 8
 * Dimensionen inkl. `range`, `search` und `merchant`. Bewusst ≠ die Dashboard-
 * activeCount (5 Dimensionen ohne `range`/`search` — dort gibt es keinen
 * Such-Filter und der Zeitraum wird separat angezeigt): die Buchungsseite
 * hat zusätzlich Range- und Such-Filter im Header und zählt sie mit.
 */
export function countActiveFilters(filters: DashboardFilterState): number {
  let count = 0;
  if (filters.category !== 'all') count += 1;
  if (filters.account !== 'all') count += 1;
  if (filters.contract !== 'all') count += 1;
  if (filters.essential !== 'all') count += 1;
  if (filters.ausgabenklasse !== 'all') count += 1;
  if (filters.range !== 'Gesamt') count += 1;
  if (filters.search.trim() !== '') count += 1;
  if ((filters.merchant ?? '').trim() !== '') count += 1;
  return count;
}
