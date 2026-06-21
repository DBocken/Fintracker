import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SlidersHorizontal, Sparkles, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AdvancedBalanceChart } from '../AdvancedBalanceChart';
import { AccountCards } from '../accounts/AccountCards';
import { TransactionStats } from './TransactionStats';
import { ExpensesOverTimeCard, SpendingBreakdownCard } from './TransactionCharts';
import { TransactionFilters } from './TransactionFilters';
import { BulkActions } from './BulkActions';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { TransactionTable } from './TransactionTable';
import { TransactionListMobile } from './TransactionListMobile';
import { TransactionDetailsModal } from './TransactionDetailsModal';
import DashboardMobileStory from './DashboardMobileStory';
import { getTransactions, getCategories, updateTransaction, deleteTransaction } from '../../services/transaction-service';
import { getAccounts } from '../../services/account-service';
import { useTransactionDetailEditing } from '@/hooks/useTransactionDetailEditing';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Transaction, Category, Account } from '../../types';
import { KpiSection } from '@/components/kpi/KpiSection';
import { dyadProps } from '@/lib/dyad';
import { usePersistedSet } from '@/hooks/usePersistedSet';
import {
  DEFAULT_DASHBOARD_FILTERS,
  type ContractFilter,
  type DashboardGranularity,
  type DashboardRange,
  type EssentialFilter,
  type AusgabenklasseFilter,
} from './filter-constants';
import { filterTransactions, getDashboardGranularity } from './filter-utils';
import { buildSankeyData, buildSpendingSunburst } from '@/lib/analysis-data';
import { SankeyChart } from '@/components/premium-dashboard/SankeyChart';
import FinanceEmptyState from '@/components/common/FinanceEmptyState';

export function Dashboard() {
  const qc = useQueryClient();

  const { data: txs = [], isLoading: txsLoading } = useQuery<Transaction[], Error>({
    queryKey: ['transactions'],
    queryFn: () => getTransactions(5000),
  });

  const { data: cats = [] } = useQuery<Category[], Error>({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  });

  const { data: accounts = [] } = useQuery<Account[], Error>({
    queryKey: ['accounts'],
    queryFn: () => getAccounts(),
  });

  const localBalances = useMemo(() => {

    const map: Record<string, number> = {};
    for (const t of txs) {
      const aid = t.account_id;
      if (!aid) continue;
      map[aid] = (map[aid] || 0) + (t.amount || 0);
    }
    return map;
  }, [txs]);

  const effectiveBalances = useMemo(() => {
    const map: Record<string, { amount: number; source: 'bank' | 'local'; balanceType?: string }> = {};
    for (const a of accounts) {
      if (a.live_balance_amount !== null && a.live_balance_amount !== undefined) {
        map[a.id] = {
          amount: Number(a.live_balance_amount) || 0,
          source: 'bank',
          balanceType: a.live_balance_type || undefined,
        };
        continue;
      }
      // Lokaler Saldo = Eröffnungssaldo (z. B. aus GoCardless-Sync) plus die
      // Summe der erfassten Transaktionen. Ohne den Eröffnungssaldo zeigt das
      // Konto fälschlich ein Minus, wenn nur ein Teil der Historie importiert ist.
      const opening = a.opening_balance ?? 0;
      map[a.id] = { amount: opening + (localBalances[a.id] ?? 0), source: 'local' };
    }
    return map;
  }, [accounts, localBalances]);

  const totalEffectiveBalance = useMemo(() => {
    return accounts.reduce((sum, a) => sum + (effectiveBalances[a.id]?.amount ?? 0), 0);
  }, [accounts, effectiveBalances]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState<string>('');
  const [_filterCat, _setFilterCat] = useState<string>(DEFAULT_DASHBOARD_FILTERS.category);
  const [_filterAccount, _setFilterAccount] = useState<string>(DEFAULT_DASHBOARD_FILTERS.account);
  const [filterContract, setFilterContract] = useState<ContractFilter>(DEFAULT_DASHBOARD_FILTERS.contract);
  const [filterEssential, setFilterEssential] = useState<EssentialFilter>(DEFAULT_DASHBOARD_FILTERS.essential);
  const [filterAusgabenklasse, setFilterAusgabenklasse] = useState<AusgabenklasseFilter>(DEFAULT_DASHBOARD_FILTERS.ausgabenklasse);
  const [searchInput, setSearchInput] = useState<string>(DEFAULT_DASHBOARD_FILTERS.search);
  const [range, setRange] = useState<DashboardRange>(DEFAULT_DASHBOARD_FILTERS.range);
  const [customDays, setCustomDays] = useState<number>(DEFAULT_DASHBOARD_FILTERS.customDays);
  const [customGran, setCustomGran] = useState<DashboardGranularity>(DEFAULT_DASHBOARD_FILTERS.customGranularity);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [hiddenTransactions, toggleHiddenTransaction] = usePersistedSet('dashboard_hidden_transactions');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction; direction: 'asc' | 'desc' } | null>(null);
  const [detailsTransaction, setDetailsTransaction] = useState<Transaction | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const mutation = useMutation<Transaction[], Error, { id: string; category_id: string }[]>({
    mutationFn: updateTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Kategorien aktualisiert');
      setSelected(new Set());
      setBulkCat('');
    },
    onError: (error) => {
      toast.error(`Fehler beim Aktualisieren: ${error.message}`);
    },
  });

  const { save: saveDetails, isPending: detailsSaving } = useTransactionDetailEditing(
    txs,
    () => setDetailsOpen(false),
  );

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Transaktion gelöscht');
      setSelected(new Set());
    },
    onError: (error) => {
      toast.error(`Fehler beim Löschen: ${error.message}`);
    },
  });

  const bulkDeleteMutation = useMutation<void, Error, string[]>({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await deleteTransaction(id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      toast.success(`${selected.size} Transaktionen gelöscht`);
      setSelected(new Set());
    },
    onError: (error) => {
      toast.error(`Fehler beim Löschen: ${error.message}`);
    },
  });

  const handleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleUpdateCategory = useCallback((transactionId: string, categoryId: string) => {
    if (!transactionId) return;
    mutation.mutate([{ id: transactionId, category_id: categoryId }]);
  }, [mutation]);

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
      saveDetails(detailsTransaction, id, patch, options);
    },
    [saveDetails, detailsTransaction],
  );

  const handleDeleteConfirmed = useCallback(() => {
    if (transactionToDelete) {
      deleteMutation.mutate(transactionToDelete);
    } else if (selected.size > 0) {
      bulkDeleteMutation.mutate(Array.from(selected));
    }
    setDeleteDialogOpen(false);
  }, [transactionToDelete, selected, deleteMutation, bulkDeleteMutation]);

  const handleApplyBulk = useCallback(() => {
    if (bulkCat && selected.size > 0) {
      mutation.mutate(Array.from(selected).map(id => ({ id, category_id: bulkCat })));
    }
  }, [bulkCat, selected, mutation]);

  const handleSort = useCallback((key: keyof Transaction) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
  }, []);

  const handleToggleVisibility = useCallback((id: string) => {
    toggleHiddenTransaction(id);
  }, [toggleHiddenTransaction]);

  const handleResetFilters = useCallback(() => {
    _setFilterCat(DEFAULT_DASHBOARD_FILTERS.category);
    _setFilterAccount(DEFAULT_DASHBOARD_FILTERS.account);
    setFilterContract(DEFAULT_DASHBOARD_FILTERS.contract);
    setFilterEssential(DEFAULT_DASHBOARD_FILTERS.essential);
    setSearchInput(DEFAULT_DASHBOARD_FILTERS.search);
    setRange(DEFAULT_DASHBOARD_FILTERS.range);
    setCustomDays(DEFAULT_DASHBOARD_FILTERS.customDays);
    setCustomGran(DEFAULT_DASHBOARD_FILTERS.customGranularity);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (_filterCat !== DEFAULT_DASHBOARD_FILTERS.category) count += 1;
    if (_filterAccount !== DEFAULT_DASHBOARD_FILTERS.account) count += 1;
    if (filterContract !== DEFAULT_DASHBOARD_FILTERS.contract) count += 1;
    if (filterEssential !== DEFAULT_DASHBOARD_FILTERS.essential) count += 1;
    if (range !== DEFAULT_DASHBOARD_FILTERS.range) count += 1;
    return count;
  }, [_filterCat, _filterAccount, filterContract, filterEssential, range]);

  const granularity = useMemo(
    () => getDashboardGranularity(range, customDays, customGran),
    [range, customDays, customGran],
  );

  const filteredTransactions = useMemo(() => {
    return filterTransactions(txs, cats, accounts, {
      category: _filterCat,
      account: _filterAccount,
      contract: filterContract,
      essential: filterEssential,
      ausgabenklasse: filterAusgabenklasse,
      search: searchInput,
      range,
      customDays,
    });
  }, [txs, cats, accounts, _filterCat, _filterAccount, filterContract, filterEssential, filterAusgabenklasse, searchInput, range, customDays]);

  const visibleTransactions = filteredTransactions.filter(t => !hiddenTransactions.has(t.id || ''));

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelected(checked ? new Set(visibleTransactions.map(t => t.id || '').filter(Boolean)) : new Set());
  }, [visibleTransactions]);

  const sortedTransactions = useMemo(() => {
    if (!sortConfig) return visibleTransactions;
    return [...visibleTransactions].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal == null || bVal == null) return 0;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal);
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [visibleTransactions, sortConfig]);

  const stats = useMemo(() => {
    const flowTransactions = visibleTransactions.filter(t => !t.is_transfer);

    const income = flowTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = flowTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const balance = income - expenses;

    const currentBalance = totalEffectiveBalance;

    // Time series data for charts - convert to array format
    const seriesObj = flowTransactions.reduce((acc, t) => {
      const date = format(parseISO(t.date), granularity === 'daily' ? 'dd.MM.' : granularity === 'weekly' ? 'dd.MM.' : 'MM.yy', { locale: de });
      if (!acc[date]) acc[date] = { income: 0, expenses: 0 };
      if (t.amount > 0) acc[date].income += t.amount;
      else acc[date].expenses += Math.abs(t.amount);
      return acc;
    }, {} as Record<string, { income: number; expenses: number }>);

    // Convert to array for TransactionCharts
    const series = Object.entries(seriesObj).map(([date, data]) => ({
      date,
      ...data
    }));

    // Sunburst: vorgelagerte Ausgabenklasse (Innenring) -> Hauptkategorie (Außenring)
    const sunburst = buildSpendingSunburst(flowTransactions, cats);

    return {
      income,
      expenses,
      balance,
      currentBalance,
      count: visibleTransactions.length,
      series,
      sunburst,
    };
  }, [visibleTransactions, totalEffectiveBalance, granularity, cats]);

  // Einfaches Sankey auf Hauptkategorien-Ebene — der Aha-Moment ist FREE
  // (Issue #40, Beschluss aus Epic #19/#25). Drilldown gibt es im Analyse-Bereich.
  const sankeyData = useMemo(
    () => buildSankeyData(visibleTransactions, cats, accounts),
    [visibleTransactions, cats, accounts]
  );

  const formatBalance = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  // Nie eine leere Seite: ohne Transaktionen klare nächste Aktionen (Issue #39).
  if (!txsLoading && txs.length === 0) {
    return <FinanceEmptyState />;
  }

  return (
    <div {...dyadProps("Dashboard")} className="space-y-6 md:space-y-8">
      {/* Das Dashboard ist Analyse-Support; die Handlung lebt im Coach
          (Audit C-P1). CTA zurück zum „nächsten Schritt". */}
      <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-brand" />
          Detailansicht für Charts &amp; Transaktionen. Deine nächste Aktion zeigt dir der Coach.
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to="/coach">
            Zum nächsten Schritt
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <TransactionStats
        income={stats.income}
        expenses={stats.expenses}
        balance={stats.balance}
        count={stats.count}
        totalTransactions={txs.length}
        currentBalance={formatBalance(stats.currentBalance)}
      />

      <KpiSection data={{ transactions: visibleTransactions }} />

      {/* Mobile: Finanz-Story mit adressierbaren Ansichten (Audit P1.4) */}
      <DashboardMobileStory
        className="lg:hidden"
        currentBalance={stats.currentBalance}
        periodNet={stats.balance}
        sunburst={stats.sunburst}
        series={stats.series}
        sankeyData={sankeyData}
        effectiveBalances={effectiveBalances}
        totalEffectiveBalance={totalEffectiveBalance}
      />

      {/* Desktop: bisheriges Raster + Cashflow */}
      <div className="hidden lg:block space-y-6">
        <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <AdvancedBalanceChart endBalanceFromAccounts={totalEffectiveBalance} />
          </div>
          <div className="xl:col-span-4">
            <SpendingBreakdownCard sunburst={stats.sunburst} />
          </div>
          <div className="xl:col-span-7">
            <ExpensesOverTimeCard series={stats.series} />
          </div>
          <div className="xl:col-span-5">
            <AccountCards balances={effectiveBalances} totalBalance={totalEffectiveBalance} />
          </div>
        </div>

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Cashflow im Überblick</h2>
            <p className="text-xs text-muted-foreground">
              Dein Geldfluss auf Hauptkategorien-Ebene. Den Drilldown in Unterkategorien findest du im Analyse-Bereich.
            </p>
          </div>
          <SankeyChart data={sankeyData} enableDrilldown={false} />
        </section>
      </div>

      <Card className="card-premium">
        <CardHeader>
          <CardTitle>Transaktionen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BulkActions
            selectedCount={selected.size}
            bulkCategory={bulkCat}
            onBulkCategoryChange={setBulkCat}
            onApplyBulk={handleApplyBulk}
            onClearSelection={() => setSelected(new Set())}
            onBulkDelete={handleDeleteConfirmed}
            categories={cats}
          />
          
          <div className="flex gap-2 items-center flex-wrap">
            <Checkbox
              aria-label="Alle sichtbaren Transaktionen auswählen"
              checked={visibleTransactions.length > 0 && visibleTransactions.every(t => selected.has(t.id || ''))}
              onCheckedChange={handleSelectAll}
            />
            <div className="relative">
              <Label htmlFor="transaction-search" className="sr-only">Transaktionen suchen</Label>
              <Input
                id="transaction-search"
                type="search"
                placeholder="Suche..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="w-48 bg-background/50 backdrop-blur-sm"
              />
            </div>
            <Button type="button" variant="outline" size="sm" className="relative" onClick={() => setFilterDialogOpen(true)}>
              <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
              Filter
              {activeFilterCount > 0 && (
                <Badge variant="default" className="ml-2 h-5 min-w-5 px-1.5 justify-center">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>

          <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
            <DialogContent className="flex max-h-[85vh] flex-col overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Filter</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <TransactionFilters
                  filterCat={_filterCat}
                  setFilterCat={_setFilterCat}
                  filterAccount={_filterAccount}
                  setFilterAccount={_setFilterAccount}
                  searchInput={searchInput}
                  setSearchInput={setSearchInput}
                  range={range}
                  setRange={setRange}
                  customDays={customDays}
                  setCustomDays={setCustomDays}
                  customGran={customGran}
                  setCustomGran={setCustomGran}
                  categories={cats}
                  filterContract={filterContract}
                  setFilterContract={setFilterContract}
                  filterEssential={filterEssential}
                  setFilterEssential={setFilterEssential}
                  filterAusgabenklasse={filterAusgabenklasse}
                  setFilterAusgabenklasse={setFilterAusgabenklasse}
                  showSearch={false}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={handleResetFilters}>
                  Filter zurücksetzen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <TransactionTable
            transactions={sortedTransactions}
            categories={cats}
            selected={selected}
            hiddenTransactions={hiddenTransactions}
            sortConfig={sortConfig}
            onSelect={handleSelect}
            onToggleVisibility={handleToggleVisibility}
            onUpdateCategory={handleUpdateCategory}
            onDelete={handleDelete}
            onSort={handleSort}
            onOpenDetails={handleOpenDetails}
          />

          <div className="md:hidden">
            <TransactionListMobile
              transactions={sortedTransactions}
              categories={cats}
              selected={selected}
              hiddenTransactions={hiddenTransactions}
              onSelect={handleSelect}
              onOpenDetails={handleOpenDetails}
            />
          </div>
          
          {sortedTransactions.length === 0 && txs.length > 0 && (
            <div className="text-center py-8 text-muted-foreground space-y-4">
              <div>
                <div className="font-medium text-foreground">Keine Transaktionen gefunden</div>
                <div className="text-sm">
                  Prüfe Filter, Suchbegriff oder lade die Daten neu, falls der Cache veraltet ist.
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleResetFilters}>
                  Filter zurücksetzen
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['transactions'] })}>
                  Erneut laden
                </Button>
              </div>
            </div>
          )}
          {txs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground space-y-4">
              <div>
                <div className="font-medium text-foreground">Keine Transaktionen vorhanden</div>
                <div className="text-sm">Importiere eine CSV-Datei, verbinde eine Bank oder lade nach einem Sync erneut.</div>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild size="sm">
                  <Link to="/csv">CSV importieren</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/accounts">Bank verbinden</Link>
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['transactions'] })}>
                  Erneut laden
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
        selectedCount={selected.size}
      />

      <TransactionDetailsModal
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        transaction={detailsTransaction}
        categories={cats}
        accounts={accounts}
        allTransactions={txs}
        onSave={handleSaveDetails}
        onToggleVisibility={handleToggleVisibility}
        onDelete={handleDelete}
        isHidden={detailsTransaction?.id ? hiddenTransactions.has(detailsTransaction.id) : false}
        isLoading={detailsSaving}
      />
    </div>
  );
}

export default Dashboard;