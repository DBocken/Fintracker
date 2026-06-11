import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { AdvancedBalanceChart } from '../AdvancedBalanceChart';
import { AccountCards } from '../accounts/AccountCards';
import { TransactionStats } from './TransactionStats';
import { TransactionCharts } from './TransactionCharts';
import { TransactionFilters } from './TransactionFilters';
import { BulkActions } from './BulkActions';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { TransactionTable } from './TransactionTable';
import { getTransactions, getCategories, updateTransaction, deleteTransaction } from '../../services/transaction-service';
import { getAccounts } from '../../services/account-service';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Transaction, Category, Account } from '../../types';
import { KpiSection } from '@/components/kpi/KpiSection';
import { dyadProps } from '@/lib/dyad';
import {
  DEFAULT_DASHBOARD_FILTERS,
  type ContractFilter,
  type DashboardGranularity,
  type DashboardRange,
  type EssentialFilter,
} from './filter-constants';
import { filterTransactions, getDashboardGranularity } from './filter-utils';

function getRootCategoryId(byId: Map<string, Category>, id: string): string {
  let current = byId.get(id);
  let guard = 0;
  while (current?.parent_id && guard < 20) {
    const parent = byId.get(current.parent_id);
    if (!parent) break;
    current = parent;
    guard += 1;
  }
  return current?.id || id;
}

export function Dashboard() {
  const qc = useQueryClient();

  const { data: txs = [] } = useQuery<Transaction[], Error>({
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
      map[a.id] = { amount: localBalances[a.id] ?? 0, source: 'local' };
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
  const [searchInput, setSearchInput] = useState<string>(DEFAULT_DASHBOARD_FILTERS.search);
  const [range, setRange] = useState<DashboardRange>(DEFAULT_DASHBOARD_FILTERS.range);
  const [customDays, setCustomDays] = useState<number>(DEFAULT_DASHBOARD_FILTERS.customDays);
  const [customGran, setCustomGran] = useState<DashboardGranularity>(DEFAULT_DASHBOARD_FILTERS.customGranularity);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [hiddenTransactions, setHiddenTransactions] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction; direction: 'asc' | 'desc' } | null>(null);

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
    setHiddenTransactions(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

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
      search: searchInput,
      range,
      customDays,
    });
  }, [txs, cats, accounts, _filterCat, _filterAccount, filterContract, filterEssential, searchInput, range, customDays]);

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
    const income = visibleTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = visibleTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const balance = income - expenses;

    const currentBalance = totalEffectiveBalance;

    // Time series data for charts - convert to array format
    const seriesObj = visibleTransactions.reduce((acc, t) => {
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

    // Sunburst: hierarchisch (Hauptkategorie -> Unterkategorie)
    const catById = new Map<string, Category>();
    cats.forEach((c) => catById.set(c.id, c));

    const innerMap = new Map<string, { id: string; name: string; value: number }>();
    const outerMap = new Map<string, { id: string; parentId: string; name: string; value: number }>();

    for (const t of visibleTransactions) {
      if (t.amount >= 0) continue;
      const amount = Math.abs(t.amount);
      const assignedId = t.category_id;

      if (!assignedId) {
        const uncInner = innerMap.get('uncategorized') || { id: 'uncategorized', name: 'Unkategorisiert', value: 0 };
        uncInner.value += amount;
        innerMap.set('uncategorized', uncInner);
        continue;
      }

      const assignedCat = catById.get(assignedId);
      const rootId = getRootCategoryId(catById, assignedId);
      const rootCat = catById.get(rootId);

      const rootName = rootCat?.name || 'Unkategorisiert';
      const inner = innerMap.get(rootId) || { id: rootId, name: rootName, value: 0 };
      inner.value += amount;
      innerMap.set(rootId, inner);

      // Outer: Wenn Unterkategorie vorhanden (parent_id existiert), nutze die direkte Unterkategorie unter root.
      if (assignedCat?.parent_id) {
        // best-effort: map deeper nesting back to the immediate child of root
        let current: Category | undefined = assignedCat;
        let guard = 0;
        while (current?.parent_id && current.parent_id !== rootId && guard < 20) {
          current = current.parent_id ? catById.get(current.parent_id) : undefined;
          guard += 1;
        }
        const child = current || assignedCat;
        const outerId = child.id;
        const outerKey = `${rootId}::${outerId}`;
        const outer = outerMap.get(outerKey) || {
          id: outerId,
          parentId: rootId,
          name: child.name,
          value: 0,
        };
        outer.value += amount;
        outerMap.set(outerKey, outer);
      }
    }

    const sunburst = {
      inner: Array.from(innerMap.values()).sort((a, b) => b.value - a.value),
      outer: Array.from(outerMap.values()).sort((a, b) => b.value - a.value),
      total: expenses,
    };

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

  const formatBalance = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <div {...dyadProps("Dashboard")} className="space-y-12">
      <KpiSection data={{ transactions: visibleTransactions }} />

      <AccountCards balances={effectiveBalances} totalBalance={totalEffectiveBalance} />

      <AdvancedBalanceChart endBalanceFromAccounts={totalEffectiveBalance} />

      <TransactionStats
        income={stats.income}
        expenses={stats.expenses}
        balance={stats.balance}
        count={stats.count}
        totalTransactions={txs.length}
        currentBalance={formatBalance(stats.currentBalance)}
      />

      <TransactionCharts
        series={stats.series}
        granularity={granularity}
        sunburst={stats.sunburst}
      />

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
            />
            <Button type="button" variant="outline" size="sm" onClick={handleResetFilters}>
              Filter zurücksetzen
            </Button>
          </div>

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
          />
          
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
    </div>
  );
}

export default Dashboard;