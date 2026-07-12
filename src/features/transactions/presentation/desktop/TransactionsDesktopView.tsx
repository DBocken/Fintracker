import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TransactionDayList } from '@/components/dashboard/TransactionDayList';
import { TransactionStats } from '@/components/dashboard/TransactionStats';
import { TransactionFilters } from '@/components/dashboard/TransactionFilters';
import { TransactionDetailsPanel } from '@/components/dashboard/TransactionDetailsPanel';
import { useI18n } from '@/i18n/useI18n';
import type {
  ContractFilter,
  EssentialFilter,
  AusgabenklasseFilter,
} from '@/components/dashboard/filter-constants';
import type { TransactionsOverviewViewModel } from '../../application/transactions-overview-view-model';
import type { TransactionsViewInteractionProps } from '../transactions-view-props';

interface Props extends TransactionsViewInteractionProps {
  model: TransactionsOverviewViewModel;
  /** Detail schließen (Desktop-Panel-X-Button, Page-`closeDetails`) — nur Desktop hat einen dedizierten Schließen-Button. */
  onCloseDetails: () => void;
}

const formatBalance = (amount: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

/**
 * Desktop: Master-Detail-Split (Verhaltensreferenz: `TransactionsPage.tsx`
 * ehem. Z. 292–409, `lg:`-Zweig). Links Filter + Kennzahlen + Tagesliste,
 * rechts sticky angedockt das Detail-Panel (horizontal 1/3 · 2/3) statt
 * Overlay. KEIN Scroll-Container um `TransactionDayList` — die
 * fenstervirtualisierte Liste braucht den normalen Page-Scroll (siehe
 * README dieser Slice).
 */
export function TransactionsDesktopView({
  model,
  detailsTransaction,
  onOpenDetails,
  onCloseDetails,
  onSaveDetails,
}: Props) {
  const { t } = useI18n();
  const { filters } = model;

  const emptyList = (
    <div className="space-y-4 py-8 text-center text-muted-foreground">
      <div>
        <div className="font-medium text-foreground">{t('transactions.emptyTitle')}</div>
        <div className="text-sm">{t('transactions.emptyHint')}</div>
      </div>
      {filters.activeCount > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={filters.reset}>
          {t('dashboard.resetFilters')}
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8 lg:space-y-0">
      {/* Linke Spalte: Filter + Kennzahlen + Tagesliste. */}
      <div className="space-y-5 lg:min-w-0">
        {/* Filter – immer sichtbar; steuern Kennzahlen + Liste. */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
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
              <Button type="button" variant="ghost" size="sm" className="h-9 gap-1" onClick={filters.reset}>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                {t('transactions.reset')}
              </Button>
            )}
          </div>
        </div>

        <TransactionStats
          income={model.stats.income}
          expenses={model.stats.expenses}
          balance={model.stats.balance}
          count={model.stats.count}
          totalTransactions={model.transactions.all.length}
          currentBalance={formatBalance(model.balances.scopedCurrent)}
        />

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
          />
        )}
      </div>

      {/* Rechte Spalte (Desktop): angedocktes Detail-Panel, horizontal 1/3 · 2/3. */}
      <aside className="hidden lg:block lg:min-w-0">
        <div className="lg:sticky lg:top-4">
          {detailsTransaction ? (
            <div>
              <div className="mb-3 flex items-center justify-between border-b pb-3">
                <h2 className="text-base font-semibold">{t('dashboard.transactionDetailsTitle')}</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t('dashboard.closeDetailsAriaLabel')}
                  onClick={onCloseDetails}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="scrollbar-subtle lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto">
                <TransactionDetailsPanel
                  transaction={detailsTransaction}
                  categories={model.categories}
                  accounts={model.accounts}
                  allTransactions={model.transactions.all}
                  onSave={onSaveDetails}
                  onToggleVisibility={model.hidden.toggle}
                  onDelete={model.actions.deleteTransaction}
                  isHidden={detailsTransaction.id ? model.hidden.ids.has(detailsTransaction.id) : false}
                  isLoading={model.actions.detailsSaving}
                  onClose={onCloseDetails}
                  closeLabel={t('common.close')}
                  layout="split"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              {t('dashboard.selectTransactionHint')}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export default TransactionsDesktopView;
