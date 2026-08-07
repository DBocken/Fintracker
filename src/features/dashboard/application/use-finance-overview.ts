import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n/useI18n';
import { getTransactions, getCategories, updateTransaction, deleteTransaction } from '@/services/transaction-service';
import { getAccounts } from '@/services/account-service';
import { getContractDecisionMap, type ContractDecision } from '@/services/contract-decision-service';
import { useTransactionDetailEditing } from '@/hooks/useTransactionDetailEditing';
import { useAllocationMap } from '@/hooks/useAllocationMap';
import { usePersistedSet } from '@/hooks/usePersistedSet';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { DEBOUNCE_MS } from '@/lib/constants';
import {
  DEFAULT_DASHBOARD_FILTERS,
  PERIOD_RANGES,
  type ContractFilter,
  type DashboardGranularity,
  type DashboardRange,
  type EssentialFilter,
  type AusgabenklasseFilter,
} from '@/components/dashboard/filter-constants';
import { filterTransactions, getDashboardGranularity, encodeDashboardFilters } from '@/components/dashboard/filter-utils';
import { listAvailablePeriods } from '@/components/dashboard/period-utils';
import { buildSankeyData, buildSpendingSunburst, buildSunburstTree } from '@/lib/analysis-data';
import type { Transaction } from '@/types';
import { dashboardKeys, DASHBOARD_TRANSACTION_LIMIT } from '../data/dashboard-query-keys';
import { computeLocalBalances, computeEffectiveBalances, computeTotalEffectiveBalance } from '../domain/balance-calculations';
import { computeFlowTotals, buildIncomeExpenseSeries } from '../domain/overview-calculations';
import type { FinanceOverviewViewModel, DashboardFilterValues, SortConfig } from './finance-overview-view-model';

// Dashboard zeigt nur eine Vorschau (Audit P1.3); die vollständige Verwaltung
// lebt auf /transactions.
const PREVIEW_COUNT = 5;

const noop = () => {};

// Stabile Referenz für den Query-Default: eine neue `new Map()` bei jedem
// Render würde die Memo-Kette bis zum ViewModel invalidieren, solange die
// Query noch lädt (Default wird bei jedem Re-Render neu erzeugt).
const EMPTY_CONTRACT_DECISIONS = new Map<string, ContractDecision>();

export type UseFinanceOverviewOptions = {
  /** Wird nach erfolgreichem Detail-Speichern aufgerufen (z.B. Modal schließen). Bleibt Sache der aufrufenden Seite. */
  onDetailsSaved?: () => void;
};

/**
 * UI-neutrales ViewModel der Finanzübersicht: Queries, Filterzustand,
 * abgeleitete Werte (Balances/Stats/Sankey) und Mutationen inkl.
 * Invalidierungen. Desktop- und Mobile-Präsentation konsumieren dasselbe
 * Ergebnis — keine Darstellungsentscheidungen (keine Farben/Spalten/JSX).
 */
export function useFinanceOverview(options?: UseFinanceOverviewOptions): FinanceOverviewViewModel {
  const { t } = useI18n();
  const qc = useQueryClient();

  const { data: txs = [], isLoading: txsLoading, isError: txsError } = useQuery<Transaction[], Error>({
    // Limit im Query-Key (F-PERF-3), sonst Cache-Kollision mit dem 1000er-Load
    // von useAutomationSuggestions. Prefix ["transactions"] invalidiert weiterhin.
    queryKey: dashboardKeys.transactions(DASHBOARD_TRANSACTION_LIMIT),
    queryFn: () => getTransactions(DASHBOARD_TRANSACTION_LIMIT),
  });

  const { data: cats = [], isError: catsError } = useQuery({
    queryKey: dashboardKeys.categories,
    queryFn: () => getCategories(),
  });

  const { data: accounts = [], isLoading: accountsLoading, isError: accountsError } = useQuery({
    queryKey: dashboardKeys.accounts,
    queryFn: () => getAccounts(),
  });

  const { data: contractDecisions = EMPTY_CONTRACT_DECISIONS, isError: contractDecisionsError } = useQuery({
    queryKey: dashboardKeys.contractDecisions,
    queryFn: getContractDecisionMap,
  });

  // Aufteilungen speisen zweierlei: die Suche (Split-Notizen) und die
  // anteilsgenaue Aggregation der Charts weiter unten.
  // Kein `refetch` von hier: Dieses ViewModel bietet fuer KEINE seiner
  // Abfragen einen Wiederholversuch an — `hasError` wird von den Views bis
  // heute nicht gelesen, sie zeigen nur `accountsError`. Diese Luecke ist
  // aelter als WP-9.6 und wird getrennt behoben; sie hier halb zu schliessen
  // waere ein Wiederholversuch fuer ein Fuenftel der Ursachen.
  const { allocations, isError: allocError } = useAllocationMap();

  const localBalances = useMemo(() => computeLocalBalances(txs), [txs]);
  const effectiveBalances = useMemo(
    () => computeEffectiveBalances(accounts, localBalances),
    [accounts, localBalances],
  );
  const totalEffectiveBalance = useMemo(
    () => computeTotalEffectiveBalance(accounts, effectiveBalances),
    [accounts, effectiveBalances],
  );

  const [category, setCategory] = useState<string>(DEFAULT_DASHBOARD_FILTERS.category);
  const [account, setAccount] = useState<string>(DEFAULT_DASHBOARD_FILTERS.account);
  const [contract, setContract] = useState<ContractFilter>(DEFAULT_DASHBOARD_FILTERS.contract);
  const [essential, setEssential] = useState<EssentialFilter>(DEFAULT_DASHBOARD_FILTERS.essential);
  const [ausgabenklasse, setAusgabenklasse] = useState<AusgabenklasseFilter>(DEFAULT_DASHBOARD_FILTERS.ausgabenklasse);
  const [search, setSearch] = useState<string>(DEFAULT_DASHBOARD_FILTERS.search);
  const [range, setRange] = useState<DashboardRange>(DEFAULT_DASHBOARD_FILTERS.range);
  const [customDays, setCustomDays] = useState<number>(DEFAULT_DASHBOARD_FILTERS.customDays);
  const [customGranularity, setCustomGranularity] = useState<DashboardGranularity>(DEFAULT_DASHBOARD_FILTERS.customGranularity);
  const [customPeriod, setCustomPeriod] = useState<string>(DEFAULT_DASHBOARD_FILTERS.customPeriod);

  const [hiddenTransactions, toggleHiddenTransaction] = usePersistedSet('dashboard_hidden_transactions');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // Beim Wechsel der Granularität die neueste verfügbare Periode vorbelegen,
  // damit sofort sinnvolle Daten erscheinen (ehem. handleSetRange).
  const setRangeWithPeriod = useCallback((next: DashboardRange) => {
    setRange(next);
    if (PERIOD_RANGES.has(next)) {
      const opts = listAvailablePeriods(txs, next);
      setCustomPeriod(opts[0]?.value ?? '');
    } else {
      setCustomPeriod('');
    }
  }, [txs]);

  // 1:1 zum ehemaligen handleResetFilters (Dashboard.tsx 204–214): setzt
  // ausgabenklasse bewusst NICHT zurück — Verhalten konserviert, nicht neu
  // entschieden.
  const reset = useCallback(() => {
    setCategory(DEFAULT_DASHBOARD_FILTERS.category);
    setAccount(DEFAULT_DASHBOARD_FILTERS.account);
    setContract(DEFAULT_DASHBOARD_FILTERS.contract);
    setEssential(DEFAULT_DASHBOARD_FILTERS.essential);
    setSearch(DEFAULT_DASHBOARD_FILTERS.search);
    setRange(DEFAULT_DASHBOARD_FILTERS.range);
    setCustomDays(DEFAULT_DASHBOARD_FILTERS.customDays);
    setCustomGranularity(DEFAULT_DASHBOARD_FILTERS.customGranularity);
    setCustomPeriod(DEFAULT_DASHBOARD_FILTERS.customPeriod);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (category !== DEFAULT_DASHBOARD_FILTERS.category) count += 1;
    if (account !== DEFAULT_DASHBOARD_FILTERS.account) count += 1;
    if (contract !== DEFAULT_DASHBOARD_FILTERS.contract) count += 1;
    if (essential !== DEFAULT_DASHBOARD_FILTERS.essential) count += 1;
    if (range !== DEFAULT_DASHBOARD_FILTERS.range) count += 1;
    return count;
  }, [category, account, contract, essential, range]);

  const granularity = useMemo(
    () => getDashboardGranularity(range, customDays, customGranularity),
    [range, customDays, customGranularity],
  );

  // Verfügbare Perioden (Jahr/Quartal/Monat) aus den Buchungen ableiten.
  const periodOptions = useMemo(
    () => (PERIOD_RANGES.has(range) ? listAvailablePeriods(txs, range) : []),
    [txs, range],
  );

  // Suche entkoppeln: das Eingabefeld bleibt an `search` gebunden (responsiv),
  // aber das teure Filtern + die daraus abgeleiteten Charts laufen erst nach dem
  // Debounce. Andere Filter wirken weiterhin sofort.
  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS);

  const filteredTransactions = useMemo(() => {
    return filterTransactions(txs, cats, accounts, {
      category,
      account,
      contract,
      essential,
      ausgabenklasse,
      search: debouncedSearch,
      range,
      customDays,
      customPeriod,
    }, new Date(), contractDecisions, { byTransaction: allocations });
  }, [txs, cats, accounts, category, account, contract, essential, ausgabenklasse, debouncedSearch, range, customDays, customPeriod, contractDecisions, allocations]);

  const visibleTransactions = useMemo(
    () => filteredTransactions.filter((tx) => !hiddenTransactions.has(tx.id || '')),
    [filteredTransactions, hiddenTransactions],
  );

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

  const previewTransactions = useMemo(() => sortedTransactions.slice(0, PREVIEW_COUNT), [sortedTransactions]);

  // Dashboard zeigt nur eine Vorschau (Audit P1.3); die vollständige Verwaltung
  // lebt auf /transactions. Die CTA übergibt die aktiven Filter per URL.
  const transactionsLink = useMemo(() => {
    const params = encodeDashboardFilters({
      category,
      account,
      contract,
      essential,
      ausgabenklasse,
      search,
      range,
      customDays,
      customPeriod,
    });
    const qs = params.toString();
    return qs ? `/transactions?${qs}` : '/transactions';
  }, [category, account, contract, essential, ausgabenklasse, search, range, customDays, customPeriod]);

  const stats = useMemo(() => {
    // Ein geteilter Durchlauf statt fünf unabhängiger Filter-Pässe: alle vier
    // Berechnungen brauchen dieselbe transferbereinigte Liste, ihre internen
    // is_transfer-Filter (siehe lib/analysis-data.ts) bleiben unangetastet und
    // sind idempotent — Ergebnis identisch, aber nur noch ein voller Durchlauf
    // über die (potenziell große) Buchungsliste.
    const flowTransactions = visibleTransactions.filter((t) => !t.is_transfer);

    const { income, expenses, balance } = computeFlowTotals(flowTransactions);
    const series = buildIncomeExpenseSeries(flowTransactions, granularity);
    // Anteilsgenau: eine aufgeteilte Buchung geht mit JEDEM Anteil in seine
    // eigene Kategorie ein (`getCategoryContributions`), statt vollständig in
    // die Kategorie der Buchung.
    const sunburst = buildSpendingSunburst(flowTransactions, cats, allocations);
    const sunburstTree = buildSunburstTree(flowTransactions, cats, allocations);

    return {
      income,
      expenses,
      balance,
      currentBalance: totalEffectiveBalance,
      count: visibleTransactions.length,
      series,
      sunburst,
      sunburstTree,
    };
  }, [visibleTransactions, totalEffectiveBalance, granularity, cats, allocations]);

  // Einfaches Sankey auf Hauptkategorien-Ebene bleibt bewusst im Free-Tier
  // (Aha-Moment für alle Nutzer); Drilldown lebt im Analyse-Bereich.
  const sankeyData = useMemo(
    () => buildSankeyData(visibleTransactions, cats, accounts, allocations),
    [visibleTransactions, cats, accounts, allocations],
  );

  const categoryMutation = useMutation<Transaction[], Error, { id: string; category_id: string }[]>({
    mutationFn: updateTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dashboardKeys.transactionsRoot });
      toast.success(t('dashboard.categoriesUpdated'));
    },
    onError: (error) => {
      toast.error(`${t('dashboard.updateError')}${error.message}`);
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dashboardKeys.transactionsRoot });
      toast.success(t('dashboard.transactionDeleted'));
    },
    onError: (error) => {
      toast.error(`${t('dashboard.deleteError')}${error.message}`);
    },
  });

  // `mutate` ist in React Query v5 per useCallback stabil, das Mutation-Objekt
  // selbst nicht — daher vor dem useCallback destrukturieren, damit die
  // Callbacks (und damit das ViewModel) referenzstabil bleiben.
  const { mutate: mutateCategory } = categoryMutation;
  const { mutate: mutateDelete } = deleteMutation;

  const updateCategory = useCallback((transactionId: string, categoryId: string) => {
    if (!transactionId) return;
    mutateCategory([{ id: transactionId, category_id: categoryId }]);
  }, [mutateCategory]);

  const deleteTransactionAction = useCallback((id: string) => {
    mutateDelete(id);
  }, [mutateDelete]);

  const { save: saveDetails, isPending: detailsSaving } = useTransactionDetailEditing(
    txs,
    options?.onDetailsSaved ?? noop,
  );

  const toggleSort = useCallback((key: keyof Transaction) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
  }, []);

  const reload = useCallback(() => {
    qc.invalidateQueries({ queryKey: dashboardKeys.transactionsRoot });
  }, [qc]);

  const filterValues = useMemo<DashboardFilterValues>(() => ({
    category,
    account,
    contract,
    essential,
    ausgabenklasse,
    search,
    range,
    customDays,
    customGranularity,
    customPeriod,
  }), [category, account, contract, essential, ausgabenklasse, search, range, customDays, customGranularity, customPeriod]);

  const filterSetters = useMemo(() => ({
    category: setCategory,
    account: setAccount,
    contract: setContract,
    essential: setEssential,
    ausgabenklasse: setAusgabenklasse,
    search: setSearch,
    range: setRangeWithPeriod,
    customDays: setCustomDays,
    customGranularity: setCustomGranularity,
    customPeriod: setCustomPeriod,
  }), [setRangeWithPeriod]);

  const filters = useMemo(() => ({
    values: filterValues,
    set: filterSetters,
    activeCount: activeFilterCount,
    periodOptions,
    transactionsLink,
    reset,
  }), [filterValues, filterSetters, activeFilterCount, periodOptions, transactionsLink, reset]);

  const sort = useMemo(() => ({ config: sortConfig, toggle: toggleSort }), [sortConfig, toggleSort]);

  const hidden = useMemo(
    () => ({ ids: hiddenTransactions, toggle: toggleHiddenTransaction }),
    [hiddenTransactions, toggleHiddenTransaction],
  );

  const actions = useMemo(() => ({
    updateCategory,
    deleteTransaction: deleteTransactionAction,
    saveDetails,
    detailsSaving,
    reload,
  }), [updateCategory, deleteTransactionAction, saveDetails, detailsSaving, reload]);

  const transactions = useMemo(() => ({
    all: txs,
    visible: visibleTransactions,
    sorted: sortedTransactions,
    preview: previewTransactions,
  }), [txs, visibleTransactions, sortedTransactions, previewTransactions]);

  const balances = useMemo(
    () => ({ byAccount: effectiveBalances, total: totalEffectiveBalance }),
    [effectiveBalances, totalEffectiveBalance],
  );

  return useMemo<FinanceOverviewViewModel>(() => ({
    loading: txsLoading,
    // WP-9.2: `!txsError` trennt "keine Buchungen" von "Buchungen nicht
    // ladbar". Ohne ihn behauptet der Screen bei einem Lesefehler das Erste.
    isEmpty: !txsLoading && !txsError && txs.length === 0,
    hasError: txsError || catsError || accountsError || contractDecisionsError || allocError,
    accountsLoading,
    accountsError,
    transactions,
    categories: cats,
    accounts,
    balances,
    stats,
    sankeyData,
    filters,
    sort,
    hidden,
    actions,
  }), [txsLoading, txsError, txs, accountsLoading, accountsError, catsError, contractDecisionsError, allocError, transactions, cats, accounts, balances, stats, sankeyData, filters, sort, hidden, actions]);
}
