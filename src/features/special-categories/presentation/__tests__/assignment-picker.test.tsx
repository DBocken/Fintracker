import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { SpecialCategory, SpecialCategoryAssignment, Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';
import { renderWithProviders } from '@/test-utils/render';
import type { Locale } from '@/i18n/translations';
import { buildSpecialCategoriesData } from '../../application/special-categories-view-model';
import type { SpecialCategoriesOverviewViewModel } from '../../application/special-categories-view-model';
import { suggestTransactionsForEvent } from '../../domain/assignment-suggestions';
import { AssignmentPicker } from '../shared/AssignmentPicker';

const cats: SpecialCategory[] = [
  { id: 'hochzeit', name: 'Hochzeit', parent_id: null },
  // Flitterwochen mit Zeitraum → Taucherset fällt in den Vorlauf.
  { id: 'flitter', name: 'Flitterwochen', parent_id: 'hochzeit', start_date: '2026-09-01', end_date: '2026-09-14', lead_days: 14 },
];

function tx(id: string, amount: number, date = '2026-08-20'): Transaction {
  return { id: asTransactionId(id), date, amount, payee: 'Amazon', description: '', original_text: '', auto_mapped: false, confirmed: true };
}

const taucherset = tx('taucher', -180); // 20.08. → Vorschlag für Flitterwochen

function buildModel(assignments: SpecialCategoryAssignment[], assign = vi.fn()): SpecialCategoriesOverviewViewModel {
  const transactions = [taucherset];
  const data = buildSpecialCategoriesData(cats, assignments, transactions);
  return {
    ...data,
    loading: false,
    isEmpty: false,
    suggestionsFor: (id: string) => {
      const cat = cats.find((c) => c.id === id);
      return cat ? suggestTransactionsForEvent(cat, transactions, assignments) : [];
    },
    actions: { save: vi.fn(), remove: vi.fn(), assign, unassign: vi.fn(), saving: false },
  };
}

describe('AssignmentPicker', () => {
  it.each<[Locale, string]>([
    ['de', 'Anlass zuordnen'],
    ['en', 'Assign occasion'],
  ])('sollte den Titel bilingual zeigen (%s)', (locale, title) => {
    renderWithProviders(<AssignmentPicker transaction={taucherset} model={buildModel([])} />, { locale });
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });

  it('sollte beim Klick die Zuordnung mit korrekten Argumenten auslösen (S2/S7)', async () => {
    const assign = vi.fn().mockResolvedValue(undefined);
    const onAssigned = vi.fn();
    renderWithProviders(
      <AssignmentPicker transaction={taucherset} model={buildModel([], assign)} onAssigned={onAssigned} />,
      { locale: 'de' },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Flitterwochen' }));
    expect(assign).toHaveBeenCalledWith({ specialCategoryId: 'flitter', transactionId: 'taucher' });
    await waitFor(() => expect(onAssigned).toHaveBeenCalled());
  });

  it('sollte den Vorschlag für diese Buchung hervorheben (S6)', () => {
    renderWithProviders(<AssignmentPicker transaction={taucherset} model={buildModel([])} />, { locale: 'de' });
    // Flitterwochen schlägt das Taucherset vor → Badge; Hochzeit (ohne Zeitraum) nicht.
    const flitterBtn = screen.getByRole('button', { name: 'Flitterwochen' });
    expect(within(flitterBtn).getByText('Vorschlag')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'Hochzeit' })).queryByText('Vorschlag')).toBeNull();
  });

  it('sollte einen bereits zugeordneten Anlass deaktivieren', () => {
    const assigned: SpecialCategoryAssignment[] = [
      { id: 'a1', special_category_id: 'flitter', transaction_id: 'taucher', source: 'manual' },
    ];
    renderWithProviders(<AssignmentPicker transaction={taucherset} model={buildModel(assigned)} />, { locale: 'de' });
    expect(screen.getByRole('button', { name: 'Flitterwochen' })).toBeDisabled();
  });

  it('sollte einen Empty-State zeigen, wenn es keine Anlässe gibt', () => {
    const empty = buildSpecialCategoriesData([], [], []);
    const model: SpecialCategoriesOverviewViewModel = {
      ...empty,
      loading: false,
      isEmpty: true,
      suggestionsFor: () => [],
      actions: { save: vi.fn(), remove: vi.fn(), assign: vi.fn(), unassign: vi.fn(), saving: false },
    };
    renderWithProviders(<AssignmentPicker transaction={taucherset} model={model} />, { locale: 'de' });
    expect(screen.getByText('Noch keine Anlässe – lege zuerst einen an.')).toBeInTheDocument();
  });
});
