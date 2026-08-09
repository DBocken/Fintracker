/**
 * Adapter `TransactionsOverviewViewModel['filters']` → `FilterViewModel`
 * (WP 5.4, KOMP-2).
 *
 * `useTransactionsOverview` exponiert absichtlich EINEN
 * `patch(Partial<DashboardFilterState>)`-Setter statt zehn Einzelsettern
 * (Verhaltensreferenz: `patchFilters` auf `TransactionsPage`) — anders als
 * `useFinanceOverview`, dessen `filters.set` schon 1:1 die Feld-Setter hat,
 * die `FilterViewModel` verlangt. Dieser Adapter übersetzt EINMAL zwischen
 * beiden Formen, statt dass jede der zehn Aufrufstellen in
 * `TransactionsListPane` selbst einen Patch-Aufruf zusammenbaut (das war der
 * Kern von KOMP-2: 21 wortgleiche Zeilen in zwei Dateien).
 *
 * Pur und exportiert (kein Hook, kein I/O) — direkt testbar ohne die Pane zu
 * mounten: `__tests__/filter-view-model-adapter.test.ts` und die
 * Parity-Prüfung in `TransactionFilters.viewmodel-parity.test.tsx` (Dashboard-
 * Durchreich vs. dieser Adapter dürfen bei gleicher Nutzeraktion nie
 * unterschiedliche Felder treffen).
 */
import type { Account, Category } from '@/types';
import type { FilterViewModel } from '@/features/shared/domain/filter-view-model';
import type { TransactionsOverviewViewModel } from '../../application/transactions-overview-view-model';

export function toFilterViewModel(
  filters: TransactionsOverviewViewModel['filters'],
  categories: Category[],
  accounts: Account[],
): FilterViewModel {
  return {
    values: {
      category: filters.values.category,
      account: filters.values.account,
      contract: filters.values.contract,
      essential: filters.values.essential,
      ausgabenklasse: filters.values.ausgabenklasse,
      search: filters.values.search,
      range: filters.values.range,
      customDays: filters.values.customDays,
      customGranularity: filters.customGranularity,
      // `DashboardFilterState.customPeriod` ist optional (URL-Fehlstelle
      // moeglich); `FilterViewModel.values.customPeriod` ist es bewusst
      // nicht — das Select-`value` von Radix darf nie `undefined` sehen.
      customPeriod: filters.values.customPeriod ?? '',
    },
    set: {
      category: (v) => filters.set.patch({ category: v }),
      account: (v) => filters.set.patch({ account: v }),
      contract: (v) => filters.set.patch({ contract: v }),
      essential: (v) => filters.set.patch({ essential: v }),
      ausgabenklasse: (v) => filters.set.patch({ ausgabenklasse: v }),
      search: (v) => filters.set.patch({ search: v }),
      range: filters.set.range,
      customDays: (v) => filters.set.patch({ customDays: v }),
      customGranularity: filters.set.customGranularity,
      customPeriod: (v) => filters.set.patch({ customPeriod: v }),
    },
    periodOptions: filters.periodOptions,
    categories,
    accounts,
  };
}
