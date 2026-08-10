import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import type { SpecialCategory, SpecialCategoryAssignment, Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';
import { renderWithProviders } from '@/test-utils/render';
import { TransactionOccasions } from '../shared/TransactionOccasions';

const { store, spies } = vi.hoisted(() => ({
  store: {
    cats: [] as SpecialCategory[],
    assignments: [] as SpecialCategoryAssignment[],
    transactions: [] as Transaction[],
  },
  spies: { assign: vi.fn(), unassign: vi.fn() },
}));

vi.mock('@/services/special-category-service', () => ({
  getSpecialCategories: async () => store.cats,
  getSpecialCategoryAssignments: async () => store.assignments,
  saveSpecialCategory: vi.fn(),
  deleteSpecialCategory: vi.fn(),
  assignTransaction: (input: unknown) => spies.assign(input) ?? Promise.resolve({}),
  unassign: (id: string) => spies.unassign(id) ?? Promise.resolve(),
}));
vi.mock('@/services/transaction-service', () => ({ getTransactions: async () => store.transactions }));

const t1: Transaction = {
  id: asTransactionId('t1'), date: '2026-09-05', amount: -45, payee: 'Taverne', description: '', original_text: '',
  auto_mapped: false, confirmed: true,
};

beforeEach(() => {
  store.cats = [
    { id: 'flitter', name: 'Flitterwochen', parent_id: null },
    { id: 'umzug', name: 'Umzug', parent_id: null },
  ];
  store.assignments = [{ id: 'a1', special_category_id: 'flitter', transaction_id: 't1', source: 'manual' }];
  store.transactions = [t1];
  spies.assign.mockReset();
  spies.unassign.mockReset();
});

describe('TransactionOccasions', () => {
  it('sollte bereits zugeordnete Anlässe der Buchung zeigen', async () => {
    renderWithProviders(<TransactionOccasions transaction={t1} />, { query: true, locale: 'de' });
    await waitFor(() => expect(screen.getByText('Zugeordnete Anlässe')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Entfernen: Flitterwochen' })).toBeInTheDocument();
  });

  it('sollte eine Zuordnung entfernen können', async () => {
    spies.unassign.mockResolvedValue(undefined);
    renderWithProviders(<TransactionOccasions transaction={t1} />, { query: true, locale: 'de' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entfernen: Flitterwochen' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen: Flitterwochen' }));
    await waitFor(() => expect(spies.unassign).toHaveBeenCalledWith('a1'));
  });

  it('sollte den Picker anbieten, um weitere Anlässe zuzuordnen', async () => {
    spies.assign.mockResolvedValue({});
    renderWithProviders(<TransactionOccasions transaction={t1} />, { query: true, locale: 'de' });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Anlass zuordnen' })).toBeInTheDocument());
    // Umzug ist noch nicht zugeordnet → klickbar; Flitterwochen bereits zugeordnet → deaktiviert.
    expect(screen.getByRole('button', { name: 'Flitterwochen' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Umzug' }));
    await waitFor(() =>
      expect(spies.assign).toHaveBeenCalledWith({ specialCategoryId: 'umzug', transactionId: 't1' }),
    );
  });
});
