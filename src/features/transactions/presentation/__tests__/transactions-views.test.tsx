import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, renderWithI18n } from '@/test-utils/render';
import type { Account, Category, Transaction } from '@/types';
import { DEFAULT_DASHBOARD_FILTERS, DEFAULT_CUSTOM_GRANULARITY } from '@/components/dashboard/filter-constants';
import type { TransactionsOverviewViewModel } from '../../application/transactions-overview-view-model';
import { TransactionsDesktopView } from '../desktop/TransactionsDesktopView';
import { TransactionsMobileView } from '../mobile/TransactionsMobileView';

// Call-Zähler-Hygiene wie im Dashboard-Pendant (dashboard-views.test.tsx):
// die not.toHaveBeenCalled-Asserts unten prüfen pro Test von Null an.
beforeEach(() => {
  vi.clearAllMocks();
});

vi.mock('@/services/transaction-service', () => ({
  getTransactions: vi.fn(),
  getCategories: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  explainCategorization: vi.fn(),
}));
vi.mock('@/services/account-service', () => ({
  getAccounts: vi.fn(),
}));
vi.mock('@/services/contract-decision-service', () => ({
  getContractDecisionMap: vi.fn(),
  upsertContractDecision: vi.fn(),
}));
vi.mock('@/components/providers/GentleModeProvider', () => ({ useGentleMode: () => ({ enabled: false }) }));

import { getTransactions, getCategories } from '@/services/transaction-service';
import { getAccounts } from '@/services/account-service';
import { getContractDecisionMap } from '@/services/contract-decision-service';

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

/** Minimales, plain-object ViewModel-Fixture — kein Hook/Query nötig (Muster: dashboard-views.test.tsx). */
function buildModel(overrides: Partial<TransactionsOverviewViewModel> = {}): TransactionsOverviewViewModel {
  return {
    loading: false,
    isEmpty: false,
    transactions: { all: FIXTURE_TRANSACTIONS, visible: FIXTURE_TRANSACTIONS },
    categories: FIXTURE_CATEGORIES,
    accounts: FIXTURE_ACCOUNTS,
    balances: { scopedCurrent: 950, ending: 950, showRunningBalance: true },
    stats: { income: 0, expenses: 50, balance: -50, count: 1 },
    filters: {
      values: { ...DEFAULT_DASHBOARD_FILTERS },
      customGranularity: DEFAULT_CUSTOM_GRANULARITY,
      set: { patch: noop, range: noop, customGranularity: noop },
      activeCount: 0,
      periodOptions: [],
      reset: noop,
    },
    hidden: { ids: new Set<string>(), toggle: noop },
    actions: {
      deleteTransaction: noop,
      saveDetails: noop as unknown as TransactionsOverviewViewModel['actions']['saveDetails'],
      detailsSaving: false,
    },
    ...overrides,
  };
}

const baseProps = {
  detailsTransaction: null,
  onOpenDetails: noop,
  onSaveDetails: noop,
};

describe('Desktop- und Mobile-View aus demselben ViewModel', () => {
  it('sollte Desktop- und Mobile-View aus demselben ViewModel rendern', () => {
    const model = buildModel();

    const desktop = renderWithProviders(
      <TransactionsDesktopView model={model} {...baseProps} onCloseDetails={noop} />,
    );
    // Buchung aus dem Model in der Tagesliste.
    expect(desktop.container.textContent).toContain('Rewe');
    // Platzhalter im rechten Panel, solange nichts ausgewählt ist.
    expect(screen.getByText(/Wähle links eine Buchung/)).toBeTruthy();
    desktop.unmount();

    const mobile = renderWithProviders(
      <TransactionsMobileView model={model} {...baseProps} detailsOpen={false} onDetailsOpenChange={noop} />,
    );
    // Dieselbe Buchung aus demselben Model, jetzt im normalen Seitenfluss.
    expect(mobile.container.textContent).toContain('Rewe');
    mobile.unmount();
  });
});

describe('Views – keine eigenen Service-Queries', () => {
  it('[REGRESSION] sollte keine eigenen Service-Queries in den Views ausführen', () => {
    const model = buildModel();

    const desktop = renderWithProviders(
      <TransactionsDesktopView model={model} {...baseProps} onCloseDetails={noop} />,
    );
    desktop.unmount();
    const mobile = renderWithProviders(
      <TransactionsMobileView model={model} {...baseProps} detailsOpen={false} onDetailsOpenChange={noop} />,
    );
    mobile.unmount();

    expect(getTransactions).not.toHaveBeenCalled();
    expect(getCategories).not.toHaveBeenCalled();
    expect(getAccounts).not.toHaveBeenCalled();
    expect(getContractDecisionMap).not.toHaveBeenCalled();
  });
});

describe('Leerer Zustand (i18n)', () => {
  const emptyModel = buildModel({ transactions: { all: FIXTURE_TRANSACTIONS, visible: [] } });

  it('sollte den leeren Zustand bilingual (de) rendern', () => {
    renderWithI18n(<TransactionsDesktopView model={emptyModel} {...baseProps} onCloseDetails={noop} />, 'de');
    expect(screen.getByText('Keine Buchungen gefunden')).toBeTruthy();
    expect(screen.getByText('Passe Filter oder Suchbegriff an.')).toBeTruthy();
  });

  it('sollte den leeren Zustand bilingual (en) rendern', () => {
    renderWithI18n(
      <TransactionsMobileView model={emptyModel} {...baseProps} detailsOpen={false} onDetailsOpenChange={noop} />,
      'en',
    );
    expect(screen.getByText('No transactions found')).toBeTruthy();
    expect(screen.getByText('Adjust filter or search term.')).toBeTruthy();
  });
});
