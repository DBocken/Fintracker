import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { SpecialCategory, SpecialCategoryAssignment, Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';
import { createHookWrapper } from '@/test-utils/render';
import { buildSpecialCategoriesData } from '../special-categories-view-model';
import { useSpecialCategoriesOverview } from '../use-special-categories-overview';

const { store, spies } = vi.hoisted(() => ({
  store: {
    cats: [] as SpecialCategory[],
    assignments: [] as SpecialCategoryAssignment[],
    transactions: [] as Transaction[],
  },
  spies: {
    save: vi.fn(),
    remove: vi.fn(),
    assign: vi.fn(),
    unassign: vi.fn(),
  },
}));

vi.mock('@/services/special-category-service', () => ({
  getSpecialCategories: async () => store.cats,
  getSpecialCategoryAssignments: async () => store.assignments,
  saveSpecialCategory: (input: Partial<SpecialCategory>) => spies.save(input) ?? Promise.resolve(input),
  deleteSpecialCategory: (id: string, options?: unknown) => spies.remove(id, options) ?? Promise.resolve({}),
  assignTransaction: (input: unknown) => spies.assign(input) ?? Promise.resolve({}),
  unassign: (id: string) => spies.unassign(id) ?? Promise.resolve(),
}));

vi.mock('@/services/transaction-service', () => ({
  getAllTransactions: async () => store.transactions,
}));

const cats: SpecialCategory[] = [
  { id: 'hochzeit', name: 'Hochzeit', parent_id: null },
  // Festes end_date → Vorschlagsfenster ist unabhängig von der Systemuhr (kein Flake).
  { id: 'flitter', name: 'Flitterwochen', parent_id: 'hochzeit', start_date: '2026-09-01', end_date: '2026-09-14', lead_days: 14 },
];

function tx(id: string, amount: number, date = '2026-09-05'): Transaction {
  return { id: asTransactionId(id), date, amount, payee: 'P', description: '', original_text: '', auto_mapped: false, confirmed: true };
}

beforeEach(() => {
  store.cats = cats;
  store.assignments = [
    { id: 'a1', special_category_id: 'hochzeit', transaction_id: 'eigen', source: 'manual' },
    { id: 'a2', special_category_id: 'flitter', transaction_id: 'kind', source: 'manual' },
  ];
  store.transactions = [tx('eigen', -8000), tx('kind', -4230), tx('taucher', -180, '2026-08-20')];
  spies.save.mockReset();
  spies.remove.mockReset();
  spies.assign.mockReset();
  spies.unassign.mockReset();
});

describe('buildSpecialCategoriesData (purer Builder)', () => {
  it('sollte Baum, Summen und Zuordnungs-Index ableiten (S3)', () => {
    const data = buildSpecialCategoriesData(cats, store.assignments, store.transactions);
    expect(data.tree.map((n) => n.id)).toEqual(['hochzeit']);
    const hochzeit = data.byId.get('hochzeit')!;
    expect(hochzeit.total.subtreeMinor).toBe(1223000); // 8000 + 4230
    expect(data.byId.get('flitter')!.total.ownMinor).toBe(423000);
    expect(data.assignmentsByEvent.get('flitter')!.map((a) => a.id)).toEqual(['a2']);
    expect(data.flat.map((n) => n.id)).toEqual(['hochzeit', 'flitter']);
  });
});

describe('useSpecialCategoriesOverview', () => {
  it('sollte Daten laden und den Parent-Teilbaum aggregieren (S3)', async () => {
    const { wrapper } = createHookWrapper();
    const { result } = renderHook(() => useSpecialCategoriesOverview(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.byId.get('hochzeit')!.total.subtreeMinor).toBe(1223000);
  });

  it('sollte Zeitfenster-Vorschläge liefern (S6)', async () => {
    const { wrapper } = createHookWrapper();
    const { result } = renderHook(() => useSpecialCategoriesOverview(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Taucherset (20.08.) liegt im Vorlauf-Fenster von Flitterwochen, ist noch
    // nicht zugeordnet → vorgeschlagen; die zugeordnete 'kind'-Buchung nicht.
    const ids = result.current.suggestionsFor('flitter').map((t) => t.id);
    expect(ids).toContain('taucher');
    expect(ids).not.toContain('kind');
  });

  it('sollte beim Zuordnen den Service aufrufen und Queries invalidieren', async () => {
    spies.assign.mockResolvedValue({ id: 'new' });
    const { wrapper, queryClient } = createHookWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useSpecialCategoriesOverview(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.actions.assign({ specialCategoryId: 'flitter', transactionId: 'taucher' });
    });

    expect(spies.assign).toHaveBeenCalledWith({ specialCategoryId: 'flitter', transactionId: 'taucher' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['special-categories'] });
  });
});
