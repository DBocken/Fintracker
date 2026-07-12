import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SlidersHorizontal, Sparkles, ArrowRight } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import { TransactionStats } from './TransactionStats';
import InteractiveCard from '@/components/common/InteractiveCard';
import { TransactionFilters } from './TransactionFilters';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { TransactionTable } from './TransactionTable';
import { TransactionListMobile } from './TransactionListMobile';
import { TransactionDetailsModal } from './TransactionDetailsModal';
import DashboardMobileStory from '@/features/dashboard/presentation/mobile/DashboardMobileStory';
import { DashboardDesktopView } from '@/features/dashboard/presentation/desktop/DashboardDesktopView';
import { useFinanceOverview } from '@/features/dashboard/application/use-finance-overview';
import type { Transaction } from '../../types';
import { KpiSection } from '@/components/kpi/KpiSection';
import { dyadProps } from '@/lib/dyad';
import AnalysisModePanel from './AnalysisModePanel';
import FinanceEmptyState from '@/components/common/FinanceEmptyState';

// Die Buchungen-Vorschau auf dem Dashboard ist reine Vorschau ohne Sammelbearbeitung
// (die lebt vollständig auf /transactions) – Auswahl bleibt hier bewusst inert.
const EMPTY_SELECTION = new Set<string>();
const noop = () => {};

export function Dashboard() {
  const { t } = useI18n();

  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [detailsTransaction, setDetailsTransaction] = useState<Transaction | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const model = useFinanceOverview({ onDetailsSaved: () => setDetailsOpen(false) });

  const handleDelete = useCallback((transactionId: string) => {
    setTransactionToDelete(transactionId);
    setDeleteDialogOpen(true);
  }, []);

  const handleOpenDetails = useCallback((transaction: Transaction) => {
    setDetailsTransaction(transaction);
    setDetailsOpen(true);
  }, []);

  const handleSaveDetails = useCallback(
    (id: string, patch: Partial<Transaction>, options: { applyToSimilar: boolean; similarIds: string[] }) => {
      if (!detailsTransaction) return;
      model.actions.saveDetails(detailsTransaction, id, patch, options);
    },
    [model.actions, detailsTransaction],
  );

  const handleDeleteConfirmed = useCallback(() => {
    if (transactionToDelete) {
      model.actions.deleteTransaction(transactionToDelete);
    }
    setDeleteDialogOpen(false);
  }, [transactionToDelete, model.actions]);

  const formatBalance = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  // Nie eine leere Seite: ohne Transaktionen klare nächste Aktionen (Issue #39).
  if (model.isEmpty) {
    return <FinanceEmptyState />;
  }

  return (
    <div {...dyadProps("Dashboard")} className="space-y-6 md:space-y-8">
      {/* Das Dashboard ist Analyse-Support; die Handlung lebt im Coach
          (Audit C-P1). Ganze Karte ist klickbar → Coach (Usability-Audit
          „Karten sind Aktionen"). */}
      <InteractiveCard to="/coach" aria-label={t("dashboard.coachPreview")}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-brand" />
          {t("dashboard.coachPreview")}
        </div>
      </InteractiveCard>

      {/* Zeitraum/Filter steuern die ganze Seite (Kennzahlen, Charts, Vorschau) –
          deshalb hier oben, statt versteckt in der Buchungen-Vorschau. */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative">
          <Label htmlFor="transaction-search" className="sr-only">{t("dashboard.transactionsSearch")}</Label>
          <Input
            id="transaction-search"
            type="search"
            placeholder={t("dashboard.search")}
            value={model.filters.values.search}
            onChange={(event) => model.filters.set.search(event.target.value)}
            className="w-48 bg-background/50 backdrop-blur-sm"
          />
        </div>
        <Button type="button" variant="outline" size="sm" className="relative" onClick={() => setFilterDialogOpen(true)}>
          <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("dashboard.filter")}
          {model.filters.activeCount > 0 && (
            <Badge variant="default" className="ml-2 h-5 min-w-5 px-1.5 justify-center">
              {model.filters.activeCount}
            </Badge>
          )}
        </Button>
      </div>

      <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
        <DialogContent className="flex max-h-[85dvh] flex-col overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dashboard.filter")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <TransactionFilters
              filterCat={model.filters.values.category}
              setFilterCat={model.filters.set.category}
              filterAccount={model.filters.values.account}
              setFilterAccount={model.filters.set.account}
              searchInput={model.filters.values.search}
              setSearchInput={model.filters.set.search}
              range={model.filters.values.range}
              setRange={model.filters.set.range}
              customDays={model.filters.values.customDays}
              setCustomDays={model.filters.set.customDays}
              customGran={model.filters.values.customGranularity}
              setCustomGran={model.filters.set.customGranularity}
              customPeriod={model.filters.values.customPeriod}
              setCustomPeriod={model.filters.set.customPeriod}
              periodOptions={model.filters.periodOptions}
              categories={model.categories}
              accounts={model.accounts}
              filterContract={model.filters.values.contract}
              setFilterContract={model.filters.set.contract}
              filterEssential={model.filters.values.essential}
              setFilterEssential={model.filters.set.essential}
              filterAusgabenklasse={model.filters.values.ausgabenklasse}
              setFilterAusgabenklasse={model.filters.set.ausgabenklasse}
              showSearch={false}
              stacked
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={model.filters.reset}>
              {t("dashboard.resetFilters")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TransactionStats
        income={model.stats.income}
        expenses={model.stats.expenses}
        balance={model.stats.balance}
        count={model.stats.count}
        totalTransactions={model.transactions.all.length}
        currentBalance={formatBalance(model.stats.currentBalance)}
      />

      <AnalysisModePanel
        allTransactions={model.transactions.all}
        categories={model.categories}
        range={model.filters.values.range}
        customDays={model.filters.values.customDays}
      />

      <KpiSection data={{ transactions: model.transactions.visible }} />

      {/* Mobile: Finanz-Story mit adressierbaren Ansichten (Audit P1.4).
          Kontostand/Saldo kommen aus TransactionStats oben – hier nicht doppelt. */}
      <DashboardMobileStory className="lg:hidden" model={model} />

      {/* Desktop: bisheriges Raster + Cashflow */}
      <DashboardDesktopView className="hidden lg:block" model={model} />

      <Card className="card-premium">
        <CardHeader>
          <CardTitle>{t("dashboard.recentTransactions")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TransactionTable
            transactions={model.transactions.preview}
            categories={model.categories}
            accounts={model.accounts}
            selected={EMPTY_SELECTION}
            hiddenTransactions={model.hidden.ids}
            sortConfig={model.sort.config}
            onSelect={noop}
            onToggleVisibility={model.hidden.toggle}
            onUpdateCategory={model.actions.updateCategory}
            onDelete={handleDelete}
            onSort={model.sort.toggle}
            onOpenDetails={handleOpenDetails}
          />

          <div className="md:hidden">
            <TransactionListMobile
              transactions={model.transactions.preview}
              categories={model.categories}
              accounts={model.accounts}
              selected={EMPTY_SELECTION}
              hiddenTransactions={model.hidden.ids}
              onSelect={noop}
              onOpenDetails={handleOpenDetails}
            />
          </div>

          {model.transactions.sorted.length > 0 && (
            <Button asChild variant="outline" className="w-full justify-center">
              <Link to={model.filters.transactionsLink}>
                {model.transactions.sorted.length > model.transactions.preview.length
                  ? t("dashboard.showAllTransactions").replace('{count}', String(model.transactions.sorted.length))
                  : t("dashboard.showAllTransactionsAlt")}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          )}

          {model.transactions.sorted.length === 0 && model.transactions.all.length > 0 && (
            <div className="text-center py-8 text-muted-foreground space-y-4">
              <div>
                <div className="font-medium text-foreground">{t("dashboard.noTransactionsFiltered")}</div>
                <div className="text-sm">
                  {t("dashboard.noTransactionsFilteredTip")}
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={model.filters.reset}>
                  {t("dashboard.resetFilters")}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={model.actions.reload}>
                  {t("dashboard.reload")}
                </Button>
              </div>
            </div>
          )}
          {model.transactions.all.length === 0 && (
            <div className="text-center py-8 text-muted-foreground space-y-4">
              <div>
                <div className="font-medium text-foreground">{t("dashboard.noTransactionsEmpty")}</div>
                <div className="text-sm">{t("dashboard.noTransactionsEmptyTip")}</div>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild size="sm">
                  <Link to="/csv">{t("dashboard.importCsv")}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/accounts">{t("dashboard.connectBank")}</Link>
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={model.actions.reload}>
                  {t("dashboard.reload")}
                </Button>
              </div>
            </div>
          )}

        </CardContent>
      </Card>

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirmed}
        transactionId={transactionToDelete}
        selectedCount={0}
      />

      <TransactionDetailsModal
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        transaction={detailsTransaction}
        categories={model.categories}
        accounts={model.accounts}
        allTransactions={model.transactions.all}
        onSave={handleSaveDetails}
        onToggleVisibility={model.hidden.toggle}
        onDelete={handleDelete}
        isHidden={detailsTransaction?.id ? model.hidden.ids.has(detailsTransaction.id) : false}
        isLoading={model.actions.detailsSaving}
      />
    </div>
  );
}

export default Dashboard;
