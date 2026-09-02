import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, renderWithI18n } from '@/test-utils/render';
import type { Account, Category, Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';
import { DEFAULT_DASHBOARD_FILTERS, DEFAULT_CUSTOM_GRANULARITY } from '@/features/shared/domain/dashboard-filters';
import type { TransactionsOverviewViewModel } from '../../application/transactions-overview-view-model';
import { TransactionsListPane } from '../shared/TransactionsListPane';
import { TransactionsDetailAside } from '../desktop/TransactionsDetailAside';
import { TransactionsDetailSheet } from '../mobile/TransactionsDetailSheet';

// Call-Zähler-Hygiene wie im Dashboard-Pendant (dashboard-views.test.tsx):
// die not.toHaveBeenCalled-Asserts unten prüfen pro Test von Null an.
beforeEach(() => {
  vi.clearAllMocks();
});

vi.mock('@/services/transaction-service', () => ({
  getAllTransactions: vi.fn(),
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

import { getAllTransactions, getCategories } from '@/services/transaction-service';
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
  { id: asTransactionId('tx-1'), date: '2026-05-05', amount: -50, payee: 'Rewe', description: '', original_text: '', auto_mapped: false, confirmed: true, category_id: CAT_FOOD, account_id: ACC_CHECKING },
];

const noop = () => {};

/** Minimales, plain-object ViewModel-Fixture — kein Hook/Query nötig (Muster: dashboard-views.test.tsx). */
function buildModel(overrides: Partial<TransactionsOverviewViewModel> = {}): TransactionsOverviewViewModel {
  return {
    loading: false,
    isEmpty: false,
    hasError: false,
    transactions: { all: FIXTURE_TRANSACTIONS, visible: FIXTURE_TRANSACTIONS },
    categories: FIXTURE_CATEGORIES,
    accounts: FIXTURE_ACCOUNTS,
    splits: { byTransaction: new Map(), matchedIds: new Set<string>() },
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
      retry: noop,
    },
    integrity: { skippedTransactionsCount: 0 },
    ...overrides,
  };
}

const listPaneProps = {
  detailsTransaction: null,
  onOpenDetails: noop,
};

const detailProps = {
  detailsTransaction: null,
  onSaveDetails: noop,
};

describe('TransactionsListPane – gemeinsamer Kern für Desktop und Mobile', () => {
  it('sollte dieselbe Tagesliste unabhängig von der umgebenden Detail-Region rendern', () => {
    const model = buildModel();

    // Einmal neben der Desktop-Detail-Spalte …
    const withAside = renderWithProviders(
      <>
        <TransactionsListPane model={model} {...listPaneProps} />
        <TransactionsDetailAside model={model} {...detailProps} onCloseDetails={noop} />
      </>,
    );
    expect(withAside.container.textContent).toContain('Rewe');
    expect(screen.getByText(/Wähle links eine Buchung/)).toBeTruthy();
    withAside.unmount();

    // … einmal neben dem Mobile-Sheet — dieselbe Liste, dasselbe ViewModel.
    const withSheet = renderWithProviders(
      <>
        <TransactionsListPane model={model} {...listPaneProps} />
        <TransactionsDetailSheet model={model} {...detailProps} detailsOpen={false} onDetailsOpenChange={noop} />
      </>,
    );
    expect(withSheet.container.textContent).toContain('Rewe');
    withSheet.unmount();
  });
});

describe('Views – keine eigenen Service-Queries', () => {
  it('[REGRESSION] sollte keine eigenen Service-Queries in den Views ausführen', () => {
    const model = buildModel();

    const rendered = renderWithProviders(
      <>
        <TransactionsListPane model={model} {...listPaneProps} />
        <TransactionsDetailAside model={model} {...detailProps} onCloseDetails={noop} />
        <TransactionsDetailSheet model={model} {...detailProps} detailsOpen={false} onDetailsOpenChange={noop} />
      </>,
    );
    rendered.unmount();

    expect(getAllTransactions).not.toHaveBeenCalled();
    expect(getCategories).not.toHaveBeenCalled();
    expect(getAccounts).not.toHaveBeenCalled();
    expect(getContractDecisionMap).not.toHaveBeenCalled();
  });
});

describe('Gefiltert-leerer Zustand (i18n)', () => {
  // Die Fixture trifft genau den Fall: Buchungen SIND da (`all`), nur sichtbar
  // ist keine. Seit WP-9.4 ist das ein eigener Zustand mit eigener Aussage —
  // vorher stand hier derselbe Text wie bei "gar nichts erfasst".
  const emptyModel = buildModel({ transactions: { all: FIXTURE_TRANSACTIONS, visible: [] } });

  it('sollte den gefiltert-leeren Zustand der ListPane bilingual (de) rendern', () => {
    renderWithI18n(<TransactionsListPane model={emptyModel} {...listPaneProps} />, 'de');
    expect(screen.getByText('Kein Treffer für diese Auswahl')).toBeTruthy();
    // Der entscheidende Satz: Er trennt diesen Zustand von "du hast noch
    // nichts erfasst".
    expect(screen.getByText(/Es gibt Buchungen/)).toBeTruthy();
  });

  it('sollte den gefiltert-leeren Zustand der ListPane bilingual (en) rendern', () => {
    renderWithI18n(<TransactionsListPane model={emptyModel} {...listPaneProps} />, 'en');
    expect(screen.getByText('No match for this selection')).toBeTruthy();
    expect(screen.getByText(/There are transactions/)).toBeTruthy();
  });

  it('sollte den wirkenden Suchbegriff benennen', () => {
    // Ohne diese Zusicherung waere der neue Text nur eine andere Formulierung
    // desselben unbrauchbaren Hinweises.
    const searched = buildModel({
      transactions: { all: FIXTURE_TRANSACTIONS, visible: [] },
      filters: { ...emptyModel.filters, values: { ...emptyModel.filters.values, search: 'Miete' } },
    });
    renderWithI18n(<TransactionsListPane model={searched} {...listPaneProps} />, 'de');
    expect(screen.getByText('Suche „Miete“')).toBeTruthy();
  });
});
