import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n/useI18n';
import { getTransactions, getCategories, deleteTransaction } from '@/services/transaction-service';
import { getAccounts } from '@/services/account-service';
import { getContractDecisionMap, type ContractDecision } from '@/services/contract-decision-service';
import { useTransactionDetailEditing } from '@/hooks/useTransactionDetailEditing';
import { usePersistedSet } from '@/hooks/usePersistedSet';
import {
  DEFAULT_DASHBOARD_FILTERS,
  DEFAULT_CUSTOM_GRANULARITY,
  PERIOD_RANGES,
  type DashboardGranularity,
  type DashboardRange,
} from '@/components/dashboard/filter-constants';
import { filterTransactions, type DashboardFilterState } from '@/components/dashboard/filter-utils';
import { listAvailablePeriods } from '@/components/dashboard/period-utils';
import type { Transaction } from '@/types';
import { transactionsKeys, FINANCE_TRANSACTION_LIMIT } from '../data/transactions-query-keys';
import { computeLocalBalances, computeEffectiveBalances } from '@/features/shared/domain/balance-calculations';
import {
  computeScopedBalance,
  computeEndingBalanceAnchor,
  hasContentFilter,
  countActiveFilters,
} from '../domain/transactions-scope';
import { computeTransactionStats } from '../domain/transaction-stats';
import type { TransactionsOverviewViewModel } from './transactions-overview-view-model';

const noop = () => {};

// Stabile Referenz für den Query-Default: eine neue `new Map()` bei jedem
// Render würde die Memo-Kette bis zum ViewModel invalidieren, solange die
// Query noch lädt (Default wird bei jedem Re-Render neu erzeugt). Muster wie
// use-finance-overview.ts.
const EMPTY_CONTRACT_DECISIONS = new Map<string, ContractDecision>();

// 1:1 zu `resetFilters` (TransactionsPage Z. 218–231): alle 9 Felder von
// `DashboardFilterState`, OHNE `customGranularity` (die lebt in einem eigenen
// `useState`, siehe unten). Modul-stabile Referenz, damit `reset()` keine
// neue Objektidentität pro Aufruf erzeugen muss.
const DEFAULT_FILTERS: DashboardFilterState = {
  category: DEFAULT_DASHBOARD_FILTERS.category,
  account: DEFAULT_DASHBOARD_FILTERS.account,
  contract: DEFAULT_DASHBOARD_FILTERS.contract,
  essential: DEFAULT_DASHBOARD_FILTERS.essential,
  ausgabenklasse: DEFAULT_DASHBOARD_FILTERS.ausgabenklasse,
  search: DEFAULT_DASHBOARD_FILTERS.search,
  range: DEFAULT_DASHBOARD_FILTERS.range,
  customDays: DEFAULT_DASHBOARD_FILTERS.customDays,
  customPeriod: DEFAULT_DASHBOARD_FILTERS.customPeriod,
};

export type UseTransactionsOverviewOptions = {
  /**
   * Einmalige Vorbelegung (Deep-Link, z. B. vom Dashboard) via
   * `useState`-Initializer — danach owned der Hook den Filter-State
   * vollständig; spätere Änderungen an `initialFilters` haben keine Wirkung.
   */
  initialFilters?: DashboardFilterState;
  /** Wird nach erfolgreichem Detail-Speichern aufgerufen (z. B. Modal schließen). Bleibt Sache der aufrufenden Seite. */
  onDetailsSaved?: () => void;
};

/**
 * UI-neutrales ViewModel der Buchungsseite: Queries, Filterzustand,
 * abgeleitete Werte (Salden/Stats) und Mutationen inkl. Invalidierungen.
 * Portiert 1:1 aus `src/pages/TransactionsPage.tsx` (Verhaltensreferenz) —
 * bewusst OHNE Router-/URL-Zeug (kein `useSearchParams` hier), das bleibt
 * Sache der Page.
 */
export function useTransactionsOverview(options?: UseTransactionsOverviewOptions): TransactionsOverviewViewModel {
  const { t } = useI18n();
  const qc = useQueryClient();

  const { data: txs = [], isLoading: txsLoading } = useQuery<Transaction[]>({
    queryKey: transactionsKeys.transactions(FINANCE_TRANSACTION_LIMIT),
    queryFn: () => getTransactions(FINANCE_TRANSACTION_LIMIT),
  });
  const { data: cats = [] } = useQuery({
    queryKey: transactionsKeys.categories,
    queryFn: () => getCategories(),
  });
  const { data: accounts = [] } = useQuery({
    queryKey: transactionsKeys.accounts,
    queryFn: () => getAccounts(),
  });
  const { data: contractDecisions = EMPTY_CONTRACT_DECISIONS } = useQuery({
    queryKey: transactionsKeys.contractDecisions,
    queryFn: getContractDecisionMap,
  });

  const [filters, setFilters] = useState<DashboardFilterState>(() => options?.initialFilters ?? DEFAULT_FILTERS);
  const [customGranularity, setCustomGranularity] = useState<DashboardGranularity>(DEFAULT_CUSTOM_GRANULARITY);
  const [hiddenTransactions, toggleHiddenTransaction] = usePersistedSet('transactions_hidden');

  const patch = useCallback((p: Partial<DashboardFilterState>) => {
    setFilters((prev) => ({ ...prev, ...p }));
  }, []);

  // `handleSetRange` (Page Z. 209–216): bei Perioden-Ranges (Jahr/Quartal/
  // Monat) die neueste verfügbare Periode vorbelegen, sonst customPeriod leeren.
  const setRange = useCallback((next: DashboardRange) => {
    if (PERIOD_RANGES.has(next)) {
      const opts = listAvailablePeriods(txs, next);
      patch({ range: next, customPeriod: opts[0]?.value ?? '' });
    } else {
      patch({ range: next, customPeriod: '' });
    }
  }, [txs, patch]);

  // `resetFilters` (Page Z. 218–231) EXAKT nachgebaut: setzt ALLE Filterfelder
  // inkl. `ausgabenklasse` UND `customGranularity` zurück — anders als der
  // Dashboard-Hook (`reset()` lässt `ausgabenklasse` dort bewusst unangetastet).
  const reset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setCustomGranularity(DEFAULT_CUSTOM_GRANULARITY);
  }, []);

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const localBalances = useMemo(() => computeLocalBalances(txs), [txs]);
  const effectiveBalances = useMemo(
    () => computeEffectiveBalances(accounts, localBalances),
    [accounts, localBalances],
  );

  const scopedCurrentBalance = useMemo(
    () => computeScopedBalance(accounts, effectiveBalances, filters.account),
    [accounts, effectiveBalances, filters.account],
  );

  const filtered = useMemo(
    // Kein Re-Sort: txs kommen datum-absteigend aus dem Service (Sortier-
    // Contract der Storage-Schicht) und filterTransactions ist ordnungserhaltend.
    () => filterTransactions(txs, cats, accounts, filters, new Date(), contractDecisions),
    [txs, cats, accounts, filters, contractDecisions],
  );

  const visible = useMemo(
    () => filtered.filter((tx) => !hiddenTransactions.has(tx.id || '')),
    [filtered, hiddenTransactions],
  );

  const endingBalance = useMemo(
    () => computeEndingBalanceAnchor({
      visible,
      all: txs,
      accountsById,
      scope: filters.account,
      scopedCurrentBalance,
    }),
    [visible, txs, accountsById, filters.account, scopedCurrentBalance],
  );

  const stats = useMemo(() => computeTransactionStats(visible), [visible]);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const periodOptions = useMemo(
    () => (PERIOD_RANGES.has(filters.range) ? listAvailablePeriods(txs, filters.range) : []),
    [txs, filters.range],
  );

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transactionsKeys.transactionsRoot });
      toast.success(t('dashboard.transactionDeleted'));
    },
    // BEWUSST ohne onError — Ist-Verhalten der Page (Z. 109–115), nicht neu entschieden.
  });
  const { mutate: mutateDelete } = deleteMutation;
  const deleteTransactionAction = useCallback((id: string) => {
    mutateDelete(id);
  }, [mutateDelete]);

  const { save: saveDetails, isPending: detailsSaving } = useTransactionDetailEditing(
    txs,
    options?.onDetailsSaved ?? noop,
  );

  const filterSet = useMemo(() => ({
    patch,
    range: setRange,
    customGranularity: setCustomGranularity,
  }), [patch, setRange]);

  const filtersVM = useMemo(() => ({
    values: filters,
    customGranularity,
    set: filterSet,
    activeCount: activeFilterCount,
    periodOptions,
    reset,
  }), [filters, customGranularity, filterSet, activeFilterCount, periodOptions, reset]);

  const balances = useMemo(() => ({
    scopedCurrent: scopedCurrentBalance,
    ending: endingBalance,
    showRunningBalance: !hasContentFilter(filters),
  }), [scopedCurrentBalance, endingBalance, filters]);

  const hidden = useMemo(
    () => ({ ids: hiddenTransactions, toggle: toggleHiddenTransaction }),
    [hiddenTransactions, toggleHiddenTransaction],
  );

  const actions = useMemo(() => ({
    deleteTransaction: deleteTransactionAction,
    saveDetails,
    detailsSaving,
  }), [deleteTransactionAction, saveDetails, detailsSaving]);

  const transactions = useMemo(() => ({ all: txs, visible }), [txs, visible]);

  return useMemo<TransactionsOverviewViewModel>(() => ({
    loading: txsLoading,
    isEmpty: !txsLoading && txs.length === 0,
    transactions,
    categories: cats,
    accounts,
    balances,
    stats,
    filters: filtersVM,
    hidden,
    actions,
  }), [txsLoading, txs, transactions, cats, accounts, balances, stats, filtersVM, hidden, actions]);
}
