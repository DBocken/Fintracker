import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@/test-utils/render';
import type { Account, Category, Transaction, TransactionAllocation } from '@/types';
import { DEFAULT_DASHBOARD_FILTERS, DEFAULT_CUSTOM_GRANULARITY } from '@/components/dashboard/filter-constants';
import type { DashboardFilterState } from '@/components/dashboard/filter-utils';
import { computeTransactionStats } from '../../domain/transaction-stats';
import { transactionsKeys } from '../../data/transactions-query-keys';
import { useTransactionsOverview } from '../use-transactions-overview';

vi.mock('@/services/transaction-service', () => ({
  getTransactions: vi.fn(),
  getCategories: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}));
vi.mock('@/services/account-service', () => ({
  getAccounts: vi.fn(),
}));
vi.mock('@/services/contract-decision-service', () => ({
  getContractDecisionMap: vi.fn(),
}));
vi.mock('@/services/transaction-allocation-service', () => ({
  getAllocationMap: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { getTransactions, getCategories, deleteTransaction } from '@/services/transaction-service';
import { getAccounts } from '@/services/account-service';
import { getContractDecisionMap } from '@/services/contract-decision-service';
import { getAllocationMap } from '@/services/transaction-allocation-service';

const CAT_FOOD = 'cat-food';
const CAT_FUN = 'cat-fun';
const CAT_INCOME = 'cat-income';
const ACC_CHECKING = 'acc-checking';
const ACC_SAVINGS = 'acc-savings';
const ACC_CASH = 'acc-cash';

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
    is_budget_pool_member: true,
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
    is_budget_pool_member: true,
    order_index: 1,
    // Bank-Live-Saldo hat Vorrang vor dem lokal berechneten Saldo.
    live_balance_amount: 250,
    live_balance_type: 'interimAvailable',
  },
  {
    id: ACC_CASH,
    user_id: 'u1',
    name: 'Bargeld',
    type: 'cash',
    currency: 'EUR',
    color: '#222',
    icon: 'wallet',
    is_budget_pool_member: false,
    order_index: 2,
    opening_balance: 500,
  },
];

// Datum-absteigend sortiert (Sortier-Contract der Storage-Schicht, siehe
// use-transactions-overview.ts). Deckt gemischte Konten (inkl. Budget-Pool-
// und Nicht-Pool-Konto sowie Live-/lokalen Saldo) und ein Transfer-Paar ab.
const FIXTURE_TRANSACTIONS: Transaction[] = [
  { id: 'tx-cash', date: '2026-06-05', amount: -30, payee: 'Kiosk', description: '', original_text: '', auto_mapped: false, confirmed: true, category_id: CAT_FOOD, account_id: ACC_CASH },
  { id: 'tx-june', date: '2026-06-01', amount: -50, payee: 'Rewe', description: '', original_text: '', auto_mapped: false, confirmed: true, category_id: CAT_FOOD, account_id: ACC_SAVINGS },
  { id: 'tx-transfer-out', date: '2026-05-20', amount: -200, payee: 'Übertrag', description: '', original_text: '', auto_mapped: false, confirmed: true, account_id: ACC_CHECKING, is_transfer: true, transfer_pair_id: 'tx-transfer-in' },
  { id: 'tx-transfer-in', date: '2026-05-20', amount: 200, payee: 'Übertrag', description: '', original_text: '', auto_mapped: false, confirmed: true, account_id: ACC_SAVINGS, is_transfer: true, transfer_pair_id: 'tx-transfer-out' },
  { id: 'tx-fun', date: '2026-05-15', amount: -100, payee: 'Kino', description: '', original_text: '', auto_mapped: false, confirmed: true, category_id: CAT_FUN, account_id: ACC_CHECKING },
  { id: 'tx-food', date: '2026-05-10', amount: -300, payee: 'Rewe', description: '', original_text: '', auto_mapped: false, confirmed: true, category_id: CAT_FOOD, account_id: ACC_CHECKING },
  { id: 'tx-income', date: '2026-05-05', amount: 2000, payee: 'Arbeitgeber GmbH', description: '', original_text: '', auto_mapped: false, confirmed: true, category_id: CAT_INCOME, account_id: ACC_CHECKING },
  { id: 'tx-old', date: '2025-01-15', amount: -20, payee: 'Rewe', description: '', original_text: '', auto_mapped: false, confirmed: true, category_id: CAT_FOOD, account_id: ACC_CHECKING },
];

const BASE_FILTERS: DashboardFilterState = {
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

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.mocked(getTransactions).mockResolvedValue(FIXTURE_TRANSACTIONS);
  vi.mocked(getCategories).mockResolvedValue(FIXTURE_CATEGORIES);
  vi.mocked(getAccounts).mockResolvedValue(FIXTURE_ACCOUNTS);
  vi.mocked(getContractDecisionMap).mockResolvedValue(new Map());
  vi.mocked(getAllocationMap).mockResolvedValue(new Map());
  vi.mocked(deleteTransaction).mockResolvedValue(undefined);
});

async function renderOverview(options?: Parameters<typeof useTransactionsOverview>[0]) {
  const { wrapper, queryClient } = createHookWrapper();
  const view = renderHook(() => useTransactionsOverview(options), { wrapper });
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return { ...view, queryClient };
}

describe('useTransactionsOverview', () => {
  describe('Happy Path', () => {
    it('sollte Stats identisch zu computeTransactionStats auf dem Fixture liefern', async () => {
      const { result } = await renderOverview();

      const expected = computeTransactionStats(FIXTURE_TRANSACTIONS);
      expect(result.current.stats).toEqual(expected);
    });

    it('sollte scopedCurrent/ending bei Scope-Wechsel (all → Einzelkonto → budget-pool) korrekt ändern', async () => {
      const { result } = await renderOverview();

      // all: CHECKING (1000 + 1380 lokal) + SAVINGS (250 Live) + CASH (500 - 30 lokal) = 3100.
      expect(result.current.balances.scopedCurrent).toBe(3100);
      expect(result.current.balances.ending).toBe(3100);

      act(() => {
        result.current.filters.set.patch({ account: ACC_CHECKING });
      });
      // CHECKING allein: 1000 + 1380 = 2380.
      expect(result.current.balances.scopedCurrent).toBe(2380);
      expect(result.current.balances.ending).toBe(2380);

      act(() => {
        result.current.filters.set.patch({ account: 'budget-pool' });
      });
      // Budget-Pool: CHECKING (2380) + SAVINGS (250) = 2630, CASH bleibt außen vor.
      expect(result.current.balances.scopedCurrent).toBe(2630);
      expect(result.current.balances.ending).toBe(2630);
    });

    it('sollte set.range auf Perioden-Range die neueste Periode vorbelegen und sonst customPeriod leeren', async () => {
      const { result } = await renderOverview();

      act(() => {
        result.current.filters.set.range('Jahr');
      });
      // Fixture enthält 2026 (neueste) und 2025 -> 2026 wird vorbelegt.
      expect(result.current.filters.values.range).toBe('Jahr');
      expect(result.current.filters.values.customPeriod).toBe('2026');

      act(() => {
        result.current.filters.set.range('30 Tage');
      });
      expect(result.current.filters.values.range).toBe('30 Tage');
      expect(result.current.filters.values.customPeriod).toBe('');
    });

    it('sollte deleteTransaction die Transaktions-Query invalidieren', async () => {
      const { result, queryClient } = await renderOverview();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      act(() => {
        result.current.actions.deleteTransaction('tx-food');
      });

      await waitFor(() => {
        expect(vi.mocked(deleteTransaction).mock.calls[0]?.[0]).toBe('tx-food');
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: transactionsKeys.transactionsRoot });
      });
      expect(transactionsKeys.transactionsRoot).toEqual(['transactions']);
    });

    it('sollte initialFilters übernehmen (Konto vorgefiltert → visible eingeschränkt)', async () => {
      const initialFilters: DashboardFilterState = { ...BASE_FILTERS, account: ACC_CHECKING };
      const { result } = await renderOverview({ initialFilters });

      expect(result.current.filters.values.account).toBe(ACC_CHECKING);
      expect(result.current.transactions.visible.map((tx) => tx.id).sort()).toEqual(
        ['tx-transfer-out', 'tx-fun', 'tx-food', 'tx-income', 'tx-old'].sort(),
      );
    });

    it('sollte hidden.toggle visible reduzieren und den localStorage-Key "transactions_hidden" verwenden', async () => {
      const { result } = await renderOverview();
      const initialCount = result.current.transactions.visible.length;

      act(() => {
        result.current.hidden.toggle('tx-fun');
      });

      expect(result.current.transactions.visible.some((tx) => tx.id === 'tx-fun')).toBe(false);
      expect(result.current.transactions.visible.length).toBe(initialCount - 1);
      expect(result.current.hidden.ids.has('tx-fun')).toBe(true);

      await waitFor(() => {
        const raw = window.localStorage.getItem('transactions_hidden');
        expect(raw).not.toBeNull();
        expect(JSON.parse(raw as string)).toContain('tx-fun');
      });
    });

    it('sollte showRunningBalance nur bei reinem Konto-/Zeitfilter true lassen (Inhaltsfilter → false)', async () => {
      const { result } = await renderOverview();

      expect(result.current.balances.showRunningBalance).toBe(true);

      act(() => {
        result.current.filters.set.patch({ account: ACC_CHECKING, range: '30 Tage' });
      });
      expect(result.current.balances.showRunningBalance).toBe(true);

      act(() => {
        result.current.filters.set.patch({ category: CAT_FOOD });
      });
      expect(result.current.balances.showRunningBalance).toBe(false);
    });
  });

  describe('Notiz-Suche', () => {
    it('sollte eine Buchung über ihre Notiz an der Buchung finden', async () => {
      vi.mocked(getTransactions).mockResolvedValue([
        ...FIXTURE_TRANSACTIONS,
        {
          id: 'tx-note', date: '2026-06-03', amount: -80, payee: 'Baumarkt', description: '', original_text: '',
          auto_mapped: false, confirmed: true, account_id: ACC_CHECKING, tax_note: 'Rechnung 2026-104',
        },
      ]);
      const { result } = await renderOverview({ initialFilters: { ...BASE_FILTERS, search: '2026-104' } });

      expect(result.current.transactions.visible.map((tx) => tx.id)).toEqual(['tx-note']);
    });

    it('sollte eine Buchung über die Notiz einer Split-Zeile finden', async () => {
      const allocations = new Map<string, TransactionAllocation[]>([
        ['tx-fun', [{
          id: 'alloc-1', transaction_id: 'tx-fun', amount_minor: -10000, category_id: CAT_FUN,
          label: 'Geburtstagsgeschenk', source: 'manual',
        } as TransactionAllocation]],
      ]);
      vi.mocked(getAllocationMap).mockResolvedValue(allocations);

      const { result } = await renderOverview({ initialFilters: { ...BASE_FILTERS, search: 'geburtstagsgeschenk' } });

      await waitFor(() => {
        expect(result.current.transactions.visible.map((tx) => tx.id)).toEqual(['tx-fun']);
      });
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte reset() ALLE Filterfelder inkl. ausgabenklasse und customGranularity zurücksetzen', async () => {
      const { result } = await renderOverview();

      act(() => {
        result.current.filters.set.patch({
          category: CAT_FOOD,
          account: ACC_CHECKING,
          contract: 'vertrag',
          essential: 'ess',
          ausgabenklasse: 'essenziell',
          search: 'Rewe',
          customDays: 45,
        });
        result.current.filters.set.customGranularity('weekly');
        // 'Jahr' belegt zugleich customPeriod vor (Perioden-Vorbelegung) — so
        // wird geprüft, dass reset() auch customPeriod zurücksetzt.
        result.current.filters.set.range('Jahr');
      });
      expect(result.current.filters.values.customPeriod).toBe('2026');
      expect(result.current.filters.customGranularity).toBe('weekly');

      act(() => {
        result.current.filters.reset();
      });

      // Anders als der Dashboard-Hook (dessen reset() `ausgabenklasse` NICHT
      // anfasst) bildet dies TransactionsPage-`resetFilters` (Z. 218–231) EXAKT
      // nach: ALLE Felder inkl. ausgabenklasse UND customGranularity zurück.
      expect(result.current.filters.values).toEqual(BASE_FILTERS);
      expect(result.current.filters.customGranularity).toBe(DEFAULT_CUSTOM_GRANULARITY);
    });

    it('[REGRESSION] sollte filters.values referenzstabil halten, wenn sich nur Nicht-Filter-State ändert (hidden.toggle)', async () => {
      const { result } = await renderOverview();

      const valuesBefore = result.current.filters.values;

      act(() => {
        result.current.hidden.toggle('tx-fun');
      });

      // URL-Schleifen-Schutz: ein neues values-Objekt bei jeder Änderung, die
      // NICHT den Filter-State betrifft, würde die Write-back-Effekte der Page
      // (useEffect auf `filters`) unnötig erneut auslösen.
      expect(Object.is(result.current.filters.values, valuesBefore)).toBe(true);
    });
  });
});
