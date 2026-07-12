import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, renderWithI18n } from '@/test-utils/render';
import type { Account, Category, Transaction } from '@/types';
import { DEFAULT_DASHBOARD_FILTERS } from '@/components/dashboard/filter-constants';
import type { FinanceOverviewViewModel } from '../../application/finance-overview-view-model';

// Recharts' ResponsiveContainer braucht ResizeObserver, den jsdom nicht kennt
// (siehe TransactionCharts.test.tsx) — No-op-Shim genügt fürs Rendern im Test.
beforeAll(() => {
  globalThis.ResizeObserver ||= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

// Call-Zähler-Hygiene: die not.toHaveBeenCalled-Asserts unten prüfen pro Test
// von Null an — ohne Reset würden Aufrufe aus vorherigen Tests fälschlich
// als "Query wurde ausgeführt" durchgehen.
beforeEach(() => {
  vi.clearAllMocks();
});

vi.mock('@/services/transaction-service', () => ({
  getTransactions: vi.fn(),
  getCategories: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  getUserSettings: vi.fn().mockResolvedValue({}),
  updateUserSettings: vi.fn(),
}));
vi.mock('@/services/account-service', () => ({
  getAccounts: vi.fn(),
}));

import { getTransactions } from '@/services/transaction-service';
import { getAccounts } from '@/services/account-service';
import { AdvancedBalanceChart } from '@/components/AdvancedBalanceChart';
import { AccountCards } from '@/components/accounts/AccountCards';
import { DashboardDesktopView } from '../desktop/DashboardDesktopView';
import DashboardMobileStory from '../mobile/DashboardMobileStory';

const CAT_FOOD = 'cat-food';
const ACC_CHECKING = 'acc-checking';

const FIXTURE_CATEGORIES: Category[] = [
  { id: CAT_FOOD, name: 'Essen', filters: [], parent_id: null, attributes: { ausgabenklasse: 'essenziell', essenziell: true } },
];

const FIXTURE_ACCOUNTS: Account[] = [
  {
    id: ACC_CHECKING,
    user_id: 'u1',
    name: 'Giro',
    type: 'checking',
    currency: 'EUR',
    color: '#000',
    icon: '🏦',
    is_budget_pool_member: false,
    order_index: 0,
    opening_balance: 1000,
  },
];

const FIXTURE_TRANSACTIONS: Transaction[] = [
  { id: 'tx-1', date: '2026-05-05', amount: -50, payee: 'Rewe', description: '', original_text: '', auto_mapped: false, confirmed: true, category_id: CAT_FOOD, account_id: ACC_CHECKING },
];

const noop = () => {};

/** Minimales, plain-object ViewModel-Fixture — kein Hook/Query nötig. */
function buildModel(overrides: Partial<FinanceOverviewViewModel> = {}): FinanceOverviewViewModel {
  return {
    loading: false,
    isEmpty: false,
    accountsLoading: false,
    accountsError: false,
    transactions: {
      all: FIXTURE_TRANSACTIONS,
      visible: FIXTURE_TRANSACTIONS,
      sorted: FIXTURE_TRANSACTIONS,
      preview: FIXTURE_TRANSACTIONS,
    },
    categories: FIXTURE_CATEGORIES,
    accounts: FIXTURE_ACCOUNTS,
    balances: {
      byAccount: { [ACC_CHECKING]: { amount: 950, source: 'local' } },
      total: 950,
    },
    stats: {
      income: 0,
      expenses: 50,
      balance: -50,
      currentBalance: 950,
      count: 1,
      series: [{ date: '05.05.', income: 0, expenses: 50 }],
      sunburst: { total: 50, inner: [], outer: [] },
      sunburstTree: { total: 50, children: [] },
    },
    sankeyData: { totalIncome: 0, accounts: [], mainCategories: [], subCategories: [] },
    filters: {
      values: { ...DEFAULT_DASHBOARD_FILTERS },
      set: {
        category: noop,
        account: noop,
        contract: noop,
        essential: noop,
        ausgabenklasse: noop,
        search: noop,
        range: noop,
        customDays: noop,
        customGranularity: noop,
        customPeriod: noop,
      },
      activeCount: 0,
      periodOptions: [],
      transactionsLink: '/transactions',
      reset: noop,
    },
    sort: { config: null, toggle: noop },
    hidden: { ids: new Set<string>(), toggle: noop },
    actions: {
      updateCategory: noop,
      deleteTransaction: noop,
      saveDetails: noop as unknown as FinanceOverviewViewModel['actions']['saveDetails'],
      detailsSaving: false,
      reload: noop,
    },
    ...overrides,
  };
}

describe('AdvancedBalanceChart – Props statt eigener Query', () => {
  it('[REGRESSION] sollte keine eigene Transaktions-Query im AdvancedBalanceChart ausführen', () => {
    renderWithProviders(
      <AdvancedBalanceChart endBalanceFromAccounts={950} transactions={FIXTURE_TRANSACTIONS} isLoading={false} />,
    );

    expect(getTransactions).not.toHaveBeenCalled();
    expect(screen.getByText('Wie entwickelt sich mein Kontostand?')).toBeInTheDocument();
  });
});

describe('AccountCards – Props statt eigener Query', () => {
  it('[REGRESSION] sollte keine eigene Konten-Query in AccountCards ausführen', () => {
    renderWithProviders(
      <AccountCards
        accounts={FIXTURE_ACCOUNTS}
        balances={{ [ACC_CHECKING]: { amount: 950, source: 'local' } }}
        totalBalance={950}
        isLoading={false}
      />,
    );

    expect(getAccounts).not.toHaveBeenCalled();
    expect(screen.getByText('Giro')).toBeInTheDocument();
  });

  it('sollte bei hasError den Fehlertext rendern', () => {
    renderWithI18n(
      <AccountCards
        accounts={FIXTURE_ACCOUNTS}
        balances={{ [ACC_CHECKING]: { amount: 950, source: 'local' } }}
        totalBalance={950}
        isLoading={false}
        hasError
      />,
    );

    expect(screen.getByText(/Fehler beim Laden der Konten|Error loading accounts/)).toBeInTheDocument();
  });
});

describe('Desktop- und Mobile-View aus demselben ViewModel', () => {
  it('sollte Desktop- und Mobile-View aus demselben ViewModel rendern', () => {
    const model = buildModel();

    const desktop = renderWithProviders(<DashboardDesktopView model={model} className="hidden lg:block" />);
    // Kontostand aus AccountCards (Desktop-Grid) — 950,00 € im Konten-Block.
    expect(desktop.container.textContent).toContain('Giro');
    expect(desktop.container.textContent).toMatch(/950,00\s?€/);
    // Chart-Container (AdvancedBalanceChart) vorhanden.
    expect(screen.getByText('Wie entwickelt sich mein Kontostand?')).toBeInTheDocument();
    desktop.unmount();

    const mobile = renderWithProviders(<DashboardMobileStory model={model} className="lg:hidden" />);
    // Default-Ansicht "Verlauf" zeigt denselben AdvancedBalanceChart aus dem Model.
    expect(screen.getByText('Wie entwickelt sich mein Kontostand?')).toBeInTheDocument();
    mobile.unmount();
  });
});
