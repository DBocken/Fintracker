import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TransactionDayList } from '@/components/dashboard/TransactionDayList';
import { TransactionStats } from '@/components/dashboard/TransactionStats';
import { TransactionFilters } from '@/components/dashboard/TransactionFilters';
import { useI18n } from '@/i18n/useI18n';
import FilteredEmptyState from '@/components/common/FilteredEmptyState';
import { describeActiveFilters } from '@/features/shared/domain/active-filters';
import { formatCurrency } from '@/lib/utils';
import type {
  ContractFilter,
  EssentialFilter,
  AusgabenklasseFilter,
} from '@/components/dashboard/filter-constants';
import type { TransactionsOverviewViewModel } from '../../application/transactions-overview-view-model';
import type { TransactionsViewInteractionProps } from '../transactions-view-props';

interface Props extends Pick<TransactionsViewInteractionProps, 'detailsTransaction' | 'onOpenDetails'> {
  model: TransactionsOverviewViewModel;
}

/**
 * Gemeinsamer Kern für Desktop UND Mobile: Suchfeld, Filter-Toolbar,
 * Kennzahlen und die fenstervirtualisierte Tagesliste — vormals byte-
 * identisch in `TransactionsDesktopView`/`TransactionsMobileView` dupliziert
 * (Verhaltensreferenz), jetzt EINMAL definiert. `TransactionsPage` mountet
 * diese Pane immer (unabhängig vom Breakpoint) — nur die Detail-Region
 * (`TransactionsDetailAside`/`TransactionsDetailSheet`) verzweigt per JS.
 * Verhindert Remount/Scroll-/Virtualizer-Verlust der `TransactionDayList`
 * bei einem Breakpoint-Wechsel (z. B. iPad-Rotation über 1024px).
 *
 * KEIN Scroll-Container um `TransactionDayList` — die Virtualisierung hängt
 * am Seiten-Scroll (siehe README dieser Slice).
 */
export function TransactionsListPane({ model, detailsTransaction, onOpenDetails }: Props) {
  const { t } = useI18n();
  const { filters } = model;

  /*
   * WP-9.4: Diese Pane rendert NUR, wenn es ueberhaupt Buchungen gibt — den
   * Fall ohne jede Erfassung faengt die Page mit `FinanceEmptyState` ab, den
   * Fall eines Lesefehlers mit `FinanceErrorState`. Null sichtbare Zeilen
   * heisst hier also immer: Die Filter treffen nichts.
   *
   * Der frueher hier stehende Hinweis auf Filter und Suchbegriff war richtig,
   * aber unbrauchbar — er sagte nicht, WELCHER Filter zu eng ist. Bei sieben
   * moeglichen Dimensionen ist das der Unterschied zwischen einem Hinweis und
   * einem Ratespiel.
   */
  const activeFilters = describeActiveFilters(filters.values);

  const emptyList = (
    <FilteredEmptyState
      active={activeFilters}
      categories={model.categories}
      accounts={model.accounts}
      onReset={filters.reset}
    />
  );

  return (
    <div className="space-y-5 lg:min-w-0">
      {/* Filter – immer sichtbar; steuern Kennzahlen + Liste. */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            data-tour-id="transactions-search"
            aria-label={t('transactions.search')}
            placeholder={t('transactions.search')}
            value={filters.values.search}
            onChange={(e) => filters.set.patch({ search: e.target.value })}
            className="h-11 w-full rounded-full border border-input bg-background/50 pl-10 pr-4 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TransactionFilters
            filterCat={filters.values.category}
            setFilterCat={(v) => filters.set.patch({ category: v })}
            filterAccount={filters.values.account}
            setFilterAccount={(v) => filters.set.patch({ account: v })}
            searchInput={filters.values.search}
            setSearchInput={(v) => filters.set.patch({ search: v })}
            range={filters.values.range}
            setRange={filters.set.range}
            customDays={filters.values.customDays}
            setCustomDays={(v) => filters.set.patch({ customDays: v })}
            customGran={filters.customGranularity}
            setCustomGran={filters.set.customGranularity}
            customPeriod={filters.values.customPeriod ?? ''}
            setCustomPeriod={(v) => filters.set.patch({ customPeriod: v })}
            periodOptions={filters.periodOptions}
            categories={model.categories}
            accounts={model.accounts}
            filterContract={filters.values.contract}
            setFilterContract={(v: ContractFilter) => filters.set.patch({ contract: v })}
            filterEssential={filters.values.essential}
            setFilterEssential={(v: EssentialFilter) => filters.set.patch({ essential: v })}
            filterAusgabenklasse={filters.values.ausgabenklasse}
            setFilterAusgabenklasse={(v: AusgabenklasseFilter) => filters.set.patch({ ausgabenklasse: v })}
            showSearch={false}
          />
          {filters.activeCount > 0 && (
            <Button
              type="button"
              data-tour-id="filter-reset"
              variant="ghost"
              size="sm"
              className="h-9 gap-1"
              onClick={filters.reset}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              {t('transactions.reset')}
            </Button>
          )}
        </div>
      </div>

      <div data-tour-id="transactions-stats">
      <TransactionStats
        income={model.stats.income}
        expenses={model.stats.expenses}
        balance={model.stats.balance}
        count={model.stats.count}
        totalTransactions={model.transactions.all.length}
        currentBalance={formatCurrency(model.balances.scopedCurrent)}
      />
      </div>

      {model.transactions.visible.length === 0 ? (
        emptyList
      ) : (
        <TransactionDayList
          transactions={model.transactions.visible}
          categories={model.categories}
          accounts={model.accounts}
          hiddenTransactions={model.hidden.ids}
          onOpenDetails={onOpenDetails}
          endingBalance={model.balances.ending}
          showRunningBalance={model.balances.showRunningBalance}
          selectedId={detailsTransaction?.id}
          allocationsByTransaction={model.splits.byTransaction}
          matchedAllocationIds={model.splits.matchedIds}
        />
      )}
    </div>
  );
}

export default TransactionsListPane;
