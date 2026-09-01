import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@/test-utils/render';
import type { Account, Category, Transaction, TransactionAllocation } from '@/types';
import { asTransactionId } from '@/lib/ids';
import { DEFAULT_DASHBOARD_FILTERS } from '@/features/shared/domain/dashboard-filters';
import { encodeDashboardFilters } from '@/features/shared/domain/dashboard-filtering';
import {
  computeFlowTotals,
} from '../../domain/overview-calculations';
import {
  computeEffectiveBalances,
  computeTotalEffectiveBalance,
} from '../../domain/balance-calculations';
import { dashboardKeys } from '../../data/dashboard-query-keys';
import { useFinanceOverview } from '../use-finance-overview';

vi.mock('@/services/transaction-service', () => ({
  getAllTransactions: vi.fn(),
  getCategories: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}));
vi.mock('@/services/account-service', () => ({
  getAccounts: vi.fn(),
}));
vi.mock('@/services/transaction-allocation-service', () => ({
  getAllocationMap: vi.fn(),
}));
vi.mock('@/services/contract-decision-service', () => ({
  getContractDecisionMap: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { getAllTransactions, getCategories, updateTransaction, deleteTransaction } from '@/services/transaction-service';
import { getAccounts } from '@/services/account-service';
import { getContractDecisionMap } from '@/services/contract-decision-service';
import { getAllocationMap } from '@/services/transaction-allocation-service';

const CAT_FOOD = 'cat-food';
const CAT_FUN = 'cat-fun';
const CAT_INCOME = 'cat-income';
const ACC_CHECKING = 'acc-checking';
const ACC_SAVINGS = 'acc-savings';

const FIXTURE_CATEGORIES: Category[] = [
  { id: CAT_FOOD, name: 'Essen', filters: [], parent_id: null, attributes: { ausgabenklasse: 'essenziell', essenziell: true } },
  { id: CAT_FUN, name: 'Freizeit', filters: [], parent_id: null, attributes: { ausgabenklasse: 'diskretionaer', essenziell: false } },
  { id: CAT_INCOME, name: 'Gehalt', filters: [], parent_id: null, attributes: { ausgabenklasse: 'einkommen' } },
];

const FIXTURE_ACCOUNTS: Account[] = [
  {
    id: ACC_CHECKING,
    user_id: 'u1',
    name: 'Giro',
    type: 'checking',
    currency: 'EUR',
    color: '#000',
    icon: 'bank',
    is_budget_pool_member: false,
    order_index: 0,
    opening_balance: 1000,
  },
  {
    id: ACC_SAVINGS,
    user_id: 'u1',
    name: 'Tagesgeld',
    type: 'savings',
    currency: 'EUR',
    color: '#111',
    icon: 'piggy-bank',
    is_budget_pool_member: false,
    order_index: 1,
    // Bank-Live-Saldo hat Vorrang vor dem lokal berechneten Saldo.
    live_balance_amount: 250,
    live_balance_type: 'interimAvailable',
  },
];

// Gemischtes Fixture: Einkommen, essenzielle/diskretionäre Ausgaben, ein
// Transfer-Paar (muss aus den Flow-Totals ausgeschlossen bleiben) sowie eine
// Buchung im Vorjahr (für den Perioden-Vorbelegungstest).
const FIXTURE_TRANSACTIONS: Transaction[] = [
  { id: asTransactionId('tx-1'), date: '2026-05-05', amount: 2000, payee: 'Arbeitgeber GmbH', description: '', original_text: '', auto_mapped: false, confirmed: true, category_id: CAT_INCOME, account_id: ACC_CHECKING },
  { id: asTransactionId('tx-2'), date: '2026-05-10', amount: -300, payee: 'Rewe', description: '', original_text: '', auto_mapped: false, confirmed: true, category_id: CAT_FOOD, account_id: ACC_CHECKING },
  { id: asTransactionId('tx-3'), date: '2026-05-15', amount: -100, payee: 'Kino', description: '', original_text: '', auto_mapped: false, confirmed: true, category_id: CAT_FUN, account_id: ACC_CHECKING },
  { id: asTransactionId('tx-4'), date: '2026-06-01', amount: -50, payee: 'Rewe', description: '', original_text: '', auto_mapped: false, confirmed: true, category_id: CAT_FOOD, account_id: ACC_SAVINGS },
  { id: asTransactionId('tx-5'), date: '2026-05-20', amount: -200, payee: 'Übertrag', description: '', original_text: '', auto_mapped: false, confirmed: true, account_id: ACC_CHECKING, is_transfer: true, transfer_pair_id: 'tx-6' },
  { id: asTransactionId('tx-6'), date: '2026-05-20', amount: 200, payee: 'Übertrag', description: '', original_text: '', auto_mapped: false, confirmed: true, account_id: ACC_SAVINGS, is_transfer: true, transfer_pair_id: 'tx-5' },
  { id: asTransactionId('tx-7'), date: '2025-01-15', amount: -20, payee: 'Rewe', description: '', original_text: '', auto_mapped: false, confirmed: true, category_id: CAT_FOOD, account_id: ACC_CHECKING },
];

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.mocked(getAllTransactions).mockResolvedValue(FIXTURE_TRANSACTIONS);
  vi.mocked(getCategories).mockResolvedValue(FIXTURE_CATEGORIES);
  vi.mocked(getAccounts).mockResolvedValue(FIXTURE_ACCOUNTS);
  vi.mocked(getContractDecisionMap).mockResolvedValue(new Map());
  vi.mocked(getAllocationMap).mockResolvedValue(new Map());
  vi.mocked(updateTransaction).mockResolvedValue([]);
  vi.mocked(deleteTransaction).mockResolvedValue(undefined);
});

async function renderOverview() {
  const { wrapper, queryClient } = createHookWrapper();
  const view = renderHook(() => useFinanceOverview(), { wrapper });
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return { ...view, queryClient };
}

describe('useFinanceOverview', () => {
  describe('Happy Path', () => {
    it('sollte Stats identisch zu den Domain-Funktionen liefern', async () => {
      const { result } = await renderOverview();

      const expectedFlow = computeFlowTotals(FIXTURE_TRANSACTIONS);
      expect(result.current.stats.income).toBe(expectedFlow.income);
      expect(result.current.stats.expenses).toBe(expectedFlow.expenses);
      expect(result.current.stats.balance).toBe(expectedFlow.balance);

      const effectiveBalances = computeEffectiveBalances(FIXTURE_ACCOUNTS, FIXTURE_TRANSACTIONS);
      const expectedTotal = computeTotalEffectiveBalance(FIXTURE_ACCOUNTS, effectiveBalances);
      expect(result.current.stats.currentBalance).toBe(expectedTotal);
    });

    it('sollte Transfers aus den Totals ausschließen', async () => {
      const { result } = await renderOverview();

      // Käme das Transfer-Paar (tx-5/-6, je 200 €) fälschlich mit rein, würden
      // Einnahmen/Ausgaben um 200 € verschoben.
      expect(result.current.stats.income).toBe(2000);
      expect(result.current.stats.expenses).toBe(470);
    });

    it('sollte Kategorie-/Konto-Filter auf visible anwenden', async () => {
      const { result } = await renderOverview();

      act(() => {
        result.current.filters.set.category(CAT_FOOD);
      });
      expect(result.current.transactions.visible.map((tx) => tx.id).sort()).toEqual(
        ['tx-2', 'tx-4', 'tx-7'].sort(),
      );

      act(() => {
        result.current.filters.reset();
      });
      act(() => {
        result.current.filters.set.account(ACC_CHECKING);
      });
      expect(result.current.transactions.visible.map((tx) => tx.id).sort()).toEqual(
        ['tx-1', 'tx-2', 'tx-3', 'tx-5', 'tx-7'].sort(),
      );
    });

    it('sollte hidden-Toggle aus visible entfernen und count reduzieren', async () => {
      const { result } = await renderOverview();
      const initialCount = result.current.stats.count;

      act(() => {
        result.current.hidden.toggle('tx-3');
      });

      expect(result.current.transactions.visible.some((tx) => tx.id === 'tx-3')).toBe(false);
      expect(result.current.stats.count).toBe(initialCount - 1);
      // Kino (-100 €, diskretionär) fällt aus den Ausgaben: 470 - 100 = 370.
      expect(result.current.stats.expenses).toBe(370);
    });

    it('sollte beim Range-Wechsel auf eine Perioden-Range die neueste Periode vorbelegen', async () => {
      const { result } = await renderOverview();

      act(() => {
        result.current.filters.set.range('Jahr');
      });

      expect(result.current.filters.values.range).toBe('Jahr');
      // Fixtures enthalten 2026 (neueste) und 2025 -> 2026 wird vorbelegt.
      expect(result.current.filters.values.customPeriod).toBe('2026');
    });

    it('sollte den transactionsLink mit encodeDashboardFilters kodieren', async () => {
      const { result } = await renderOverview();

      act(() => {
        result.current.filters.set.category(CAT_FOOD);
      });

      const expected = encodeDashboardFilters({
        category: CAT_FOOD,
        account: 'all',
        contract: 'all',
        essential: 'all',
        ausgabenklasse: 'all',
        search: '',
        range: 'Gesamt',
        customDays: 30,
        customPeriod: '',
      });
      expect(result.current.filters.transactionsLink).toBe(`/transactions?${expected.toString()}`);
    });

    it('sollte updateCategory die Transaktions-Query invalidieren', async () => {
      const { result, queryClient } = await renderOverview();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      act(() => {
        result.current.actions.updateCategory('tx-2', CAT_FUN);
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dashboardKeys.transactionsRoot });
      });
    });

    it('sollte deleteTransaction ausführen und die Transaktions-Query invalidieren', async () => {
      const { result, queryClient } = await renderOverview();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      act(() => {
        result.current.actions.deleteTransaction('tx-2');
      });

      await waitFor(() => {
        // React Query v5 ruft mutationFn(variables, mutationFnContext) auf —
        // nur die eigentliche ID (erstes Argument) interessiert hier.
        expect(vi.mocked(deleteTransaction).mock.calls[0]?.[0]).toBe('tx-2');
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dashboardKeys.transactionsRoot });
      });
    });

    it('sollte customPeriod leeren wenn keine Perioden verfügbar sind', async () => {
      // Ohne Buchungen liefert listAvailablePeriods() eine leere Liste ->
      // die Range-Vorbelegung muss auf '' zurückfallen statt eine Periode zu raten.
      vi.mocked(getAllTransactions).mockResolvedValue([]);
      const { result } = await renderOverview();

      act(() => {
        result.current.filters.set.range('Jahr');
      });

      expect(result.current.filters.values.customPeriod).toBe('');
    });

    it('sollte Sortier-Toggle asc/desc wechseln', async () => {
      const { result } = await renderOverview();

      act(() => {
        result.current.sort.toggle('date');
      });
      expect(result.current.sort.config).toEqual({ key: 'date', direction: 'desc' });

      act(() => {
        result.current.sort.toggle('date');
      });
      expect(result.current.sort.config).toEqual({ key: 'date', direction: 'asc' });
    });
  });

  describe('Notiz-Suche', () => {
    it('sollte über die Notiz an der Buchung und die Notiz einer Split-Zeile filtern', async () => {
      vi.mocked(getAllTransactions).mockResolvedValue([
        ...FIXTURE_TRANSACTIONS,
        { id: asTransactionId('tx-note'), date: '2026-05-12', amount: -80, payee: 'Baumarkt', description: '', original_text: '', auto_mapped: false, confirmed: true, category_id: CAT_FOOD, account_id: ACC_CHECKING, tax_note: 'Rechnung 2026-104' },
      ]);
      vi.mocked(getAllocationMap).mockResolvedValue(
        new Map<string, TransactionAllocation[]>([
          ['tx-3', [{ id: 'alloc-1', transaction_id: 'tx-3', amount_minor: -10000, category_id: CAT_FUN, label: 'Geburtstagsgeschenk', source: 'manual' } as TransactionAllocation]],
        ]),
      );
      const { result } = await renderOverview();

      act(() => {
        result.current.filters.set.search('2026-104');
      });
      await waitFor(() => {
        expect(result.current.transactions.visible.map((tx) => tx.id)).toEqual(['tx-note']);
      });

      act(() => {
        result.current.filters.set.search('geburtstagsgeschenk');
      });
      await waitFor(() => {
        expect(result.current.transactions.visible.map((tx) => tx.id)).toEqual(['tx-3']);
      });
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte reset() exakt die Felder der bisherigen handleResetFilters zurücksetzen', async () => {
      const { result } = await renderOverview();

      act(() => {
        result.current.filters.set.category(CAT_FOOD);
        result.current.filters.set.account(ACC_CHECKING);
        result.current.filters.set.contract('vertrag');
        result.current.filters.set.essential('ess');
        result.current.filters.set.ausgabenklasse('essenziell');
        result.current.filters.set.search('Rewe');
        result.current.filters.set.customDays(45);
        result.current.filters.set.customGranularity('weekly');
        // 'Jahr' belegt zugleich customPeriod vor (Perioden-Vorbelegung) — so
        // wird geprüft, dass reset() auch customPeriod zurücksetzt.
        result.current.filters.set.range('Jahr');
      });
      expect(result.current.filters.values.customPeriod).toBe('2026');

      act(() => {
        result.current.filters.reset();
      });

      // Nachgebaut aus dem ehemaligen handleResetFilters (Dashboard.tsx 204–214):
      // ausgabenklasse wird dort NICHT angefasst — dieses Verhalten wird bewusst
      // konserviert, nicht neu entschieden.
      expect(result.current.filters.values).toEqual({
        category: DEFAULT_DASHBOARD_FILTERS.category,
        account: DEFAULT_DASHBOARD_FILTERS.account,
        contract: DEFAULT_DASHBOARD_FILTERS.contract,
        essential: DEFAULT_DASHBOARD_FILTERS.essential,
        ausgabenklasse: 'essenziell',
        search: DEFAULT_DASHBOARD_FILTERS.search,
        range: DEFAULT_DASHBOARD_FILTERS.range,
        customDays: DEFAULT_DASHBOARD_FILTERS.customDays,
        customGranularity: DEFAULT_DASHBOARD_FILTERS.customGranularity,
        customPeriod: DEFAULT_DASHBOARD_FILTERS.customPeriod,
      });
    });

    it('[REGRESSION] sollte isEmpty nur ohne Transaktionen nach Ladeende true sein', async () => {
      let resolveTransactions!: (txs: Transaction[]) => void;
      const pending = new Promise<Transaction[]>((resolve) => {
        resolveTransactions = resolve;
      });
      vi.mocked(getAllTransactions).mockReturnValue(pending);

      const { wrapper } = createHookWrapper();
      const { result } = renderHook(() => useFinanceOverview(), { wrapper });

      // Während des Ladens ist `all` per Default leer, aber isEmpty MUSS false
      // bleiben (loading=true) — sonst flackert kurz ein Empty-State auf.
      expect(result.current.loading).toBe(true);
      expect(result.current.isEmpty).toBe(false);

      await act(async () => {
        resolveTransactions([]);
        await pending;
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.isEmpty).toBe(true);
    });

    it('[REGRESSION] sollte dieselbe ViewModel-Referenz stabile Teilobjekte für unveränderte Eingaben liefern (kein neues stats-Objekt bei reinem Sort-Toggle)', async () => {
      const { result } = await renderOverview();

      const statsBefore = result.current.stats;
      const balancesBefore = result.current.balances;
      const categoriesBefore = result.current.categories;
      const sankeyBefore = result.current.sankeyData;

      act(() => {
        result.current.sort.toggle('date');
      });

      expect(Object.is(result.current.stats, statsBefore)).toBe(true);
      expect(Object.is(result.current.balances, balancesBefore)).toBe(true);
      expect(Object.is(result.current.categories, categoriesBefore)).toBe(true);
      expect(Object.is(result.current.sankeyData, sankeyBefore)).toBe(true);
      expect(result.current.sort.config).toEqual({ key: 'date', direction: 'desc' });
    });

    it('[REGRESSION] sollte accountsLoading den Ladezustand der accounts-Query unabhängig von der Transaktions-Query spiegeln', async () => {
      let resolveAccounts!: (accounts: Account[]) => void;
      const pending = new Promise<Account[]>((resolve) => {
        resolveAccounts = resolve;
      });
      vi.mocked(getAccounts).mockReturnValue(pending);

      const { wrapper } = createHookWrapper();
      const { result } = renderHook(() => useFinanceOverview(), { wrapper });

      // Transaktionen sind bereits fertig geladen, die accounts-Query hängt
      // noch -> accountsLoading darf NICHT einfach `loading` mitbenutzen.
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.accountsLoading).toBe(true);
      expect(result.current.accountsError).toBe(false);

      await act(async () => {
        resolveAccounts(FIXTURE_ACCOUNTS);
        await pending;
      });

      await waitFor(() => expect(result.current.accountsLoading).toBe(false));
    });

    it('[REGRESSION] sollte accountsError bei fehlgeschlagener accounts-Query true werden', async () => {
      vi.mocked(getAccounts).mockRejectedValue(new Error('accounts down'));

      const { wrapper } = createHookWrapper();
      const { result } = renderHook(() => useFinanceOverview(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));
      await waitFor(() => expect(result.current.accountsError).toBe(true));
      expect(result.current.accountsLoading).toBe(false);
    });
  });
});
