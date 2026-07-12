import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TransactionDayList } from '@/components/dashboard/TransactionDayList';
import { TransactionStats } from '@/components/dashboard/TransactionStats';
import { TransactionFilters } from '@/components/dashboard/TransactionFilters';
import { TransactionDetailsModal } from '@/components/dashboard/TransactionDetailsModal';
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
  /** Overlay-Sichtbarkeit (Page-State `detailsOpen`). */
  detailsOpen: boolean;
  /** 1:1 an `TransactionDetailsModal.onOpenChange` (Page-`(open) => (open ? setDetailsOpen(true) : closeDetails())`). */
  onDetailsOpenChange: (open: boolean) => void;
}

const formatBalance = (amount: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

/**
 * Mobile: Liste im normalen Seitenfluss + Detail als Overlay statt
 * angedocktes Panel (Verhaltensreferenz: `TransactionsPage.tsx`, ehem.
 * gemeinsamer Zweig + `TransactionDetailsModal` am Seitenende). Gleiche
 * Daten/Aktionen wie Desktop (Paritätsprinzip) — nur die Detaildarstellung
 * unterscheidet sich. KEIN Scroll-Container um `TransactionDayList` (siehe
 * README dieser Slice). Die interne 768px-Dialog/Sheet-Weiche steckt bereits
 * in `TransactionDetailsModal` und bleibt unangetastet.
 */
export function TransactionsMobileView({
  model,
  detailsTransaction,
  onOpenDetails,
  onSaveDetails,
  detailsOpen,
  onDetailsOpenChange,
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
    <div className="space-y-5">
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

      {/* Overlay/Sheet: Dialog auf ≥768px, Bottom-Sheet darunter (interne Weiche im Modal). */}
      <TransactionDetailsModal
        open={detailsOpen}
        onOpenChange={onDetailsOpenChange}
        transaction={detailsTransaction}
        categories={model.categories}
        accounts={model.accounts}
        allTransactions={model.transactions.all}
        onSave={onSaveDetails}
        onToggleVisibility={model.hidden.toggle}
        onDelete={model.actions.deleteTransaction}
        isHidden={detailsTransaction?.id ? model.hidden.ids.has(detailsTransaction.id) : false}
        isLoading={model.actions.detailsSaving}
      />
    </div>
  );
}

export default TransactionsMobileView;
