import { useMemo } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { TransactionDayList } from '@/components/dashboard/TransactionDayList';
import { TransactionStats } from '@/components/dashboard/TransactionStats';
import { TransactionFilters } from '@/components/dashboard/TransactionFilters';
import { useI18n } from '@/i18n/useI18n';
import FilteredEmptyState from '@/features/shared/presentation/FilteredEmptyState';
import { describeActiveFilters } from '@/features/shared/domain/active-filters';
import { formatCurrency } from '@/lib/utils';
import type { TransactionsOverviewViewModel } from '../../application/transactions-overview-view-model';
import type { TransactionsViewInteractionProps } from '../transactions-view-props';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import { toFilterViewModel } from './filter-view-model-adapter';

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
  const money = useMoneyFormat();
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

  const filterViewModel = useMemo(
    () => toFilterViewModel(filters, model.categories, model.accounts),
    [filters, model.categories, model.accounts],
  );

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
      {/*
        Der Tour-Anker des Buchungen-Einstiegsschritts (`tutorial-steps.ts`,
        Kapitel `transactions`, Schritt `overview`) sitzt bewusst NUR um
        Suche + Filter + Kennzahlen — nicht um die (potenziell sehr lange,
        fenstervirtualisierte) Tagesliste darunter. Der Anker lag vorher auf
        dem gesamten Grid in `TransactionsPage`; `scrollIntoView({block:
        'center'})` zentrierte dieses hohe Element und landete damit fast am
        Seitenende statt oben, wo der erklärte Inhalt tatsächlich steht.
      */}
      <div data-tour-id="transactions-list" className="space-y-5">
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
          {/* Auf dem Telefon: EIN Knopf statt fuenf Auswahlfelder.
              Auf dem Geraet nachgesehen belegte die Filterleiste hier rund
              450 Pixel — man scrollte an einer Wand aus Auswahlfeldern
              vorbei, bevor die erste Buchung sichtbar wurde. Das Dashboard
              loest denselben Fall laengst so (Knopf + Dialog); diese Flaeche
              tat es als einzige nicht.

              Bottom Sheet statt Dialog: AGENTS.md §4 nennt Bottom Sheets als
              das mobile Muster, und die Auswahl liegt damit dort, wo der
              Daumen ist. Die Zahl im Knopf sagt, wie viele Filter greifen —
              sonst ist ein eingeklappter Filter ein unsichtbarer Filter, und
              der Nutzer sucht den Grund fuer eine kurze Liste an der falschen
              Stelle. */}
          <div className="flex flex-wrap items-center gap-2 lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" className="min-h-[44px] gap-2">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  {t('transactions.filter')}
                  {filters.activeCount > 0 && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                      {filters.activeCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent
                side="bottom"
                // max-h an die *sichtbare* Hoehe (dvh) und scrollbar: Bei
                // gewaehltem Zeitraum „Benutzerdefiniert" kommen Regler und
                // Granularitaet dazu, und auf einem kleinen Geraet passt das
                // sonst nicht mehr aufs Blatt.
                className="max-h-[85dvh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
                aria-describedby={undefined}
              >
                <SheetHeader className="text-left">
                  <SheetTitle>{t('transactions.filter')}</SheetTitle>
                </SheetHeader>
                <div className="mt-4 flex flex-col gap-3">
                  <TransactionFilters filters={filterViewModel} showSearch={false} stacked />
                </div>
              </SheetContent>
            </Sheet>
            {filters.activeCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                className="min-h-[44px] gap-1"
                onClick={filters.reset}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                {t('transactions.reset')}
              </Button>
            )}
          </div>

          {/* Ab lg die vertraute Werkzeugleiste: Auf einem breiten Bildschirm
              ist gleichzeitige Sichtbarkeit der Vorteil, nicht das Problem. */}
          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            <TransactionFilters filters={filterViewModel} showSearch={false} />
            {filters.activeCount > 0 && (
              <Button
                type="button"
                data-tour-id="filter-reset"
                variant="ghost"
                size="sm"
                className="h-9 gap-1 pointer-coarse:min-h-11"
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
          currentBalance={money.mask(formatCurrency(model.balances.scopedCurrent))}
        />
        </div>
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
