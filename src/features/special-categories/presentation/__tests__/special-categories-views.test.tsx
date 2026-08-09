import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import type { SpecialCategory, SpecialCategoryAssignment, Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';
import { renderWithProviders } from '@/test-utils/render';
import type { Locale } from '@/i18n/translations';
import { buildSpecialCategoriesData } from '../../application/special-categories-view-model';
import type { SpecialCategoriesOverviewViewModel } from '../../application/special-categories-view-model';
import { suggestTransactionsForEvent } from '../../domain/assignment-suggestions';
import { SpecialCategoriesDesktopView } from '../desktop/SpecialCategoriesDesktopView';
import { SpecialCategoriesMobileStory } from '../mobile/SpecialCategoriesMobileStory';

const cats: SpecialCategory[] = [
  { id: 'hochzeit', name: 'Hochzeit', parent_id: null },
  { id: 'flitter', name: 'Flitterwochen', parent_id: 'hochzeit' },
];

function tx(id: string, amount: number): Transaction {
  return { id: asTransactionId(id), date: '2026-09-05', amount, payee: 'P', description: '', original_text: '', auto_mapped: false, confirmed: true };
}

const assignments: SpecialCategoryAssignment[] = [
  { id: 'a1', special_category_id: 'hochzeit', transaction_id: 'eigen', source: 'manual' },
  { id: 'a2', special_category_id: 'flitter', transaction_id: 'kind', source: 'manual' },
];
const transactions = [tx('eigen', -8000), tx('kind', -4230)];

function buildModel(overrides?: Partial<SpecialCategoriesOverviewViewModel>): SpecialCategoriesOverviewViewModel {
  const data = buildSpecialCategoriesData(cats, assignments, transactions);
  return {
    ...data,
    loading: false,
    isEmpty: false,
    suggestionsFor: (id: string) => {
      const cat = cats.find((c) => c.id === id);
      return cat ? suggestTransactionsForEvent(cat, transactions, assignments) : [];
    },
    actions: { save: vi.fn(), remove: vi.fn(), assign: vi.fn(), unassign: vi.fn(), saving: false },
    ...overrides,
  };
}

function emptyModel(): SpecialCategoriesOverviewViewModel {
  const data = buildSpecialCategoriesData([], [], []);
  return {
    ...data,
    loading: false,
    isEmpty: true,
    suggestionsFor: () => [],
    actions: { save: vi.fn(), remove: vi.fn(), assign: vi.fn(), unassign: vi.fn(), saving: false },
  };
}

describe('SpecialCategoriesDesktopView', () => {
  it.each<[Locale, string]>([
    ['de', 'Anlässe'],
    ['en', 'Occasions'],
  ])('sollte Titel und Parent-Teilbaumsumme bilingual zeigen (%s, S3)', (locale, title) => {
    renderWithProviders(<SpecialCategoriesDesktopView model={buildModel()} />, { locale });
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    // Gesamtsumme Hochzeit inkl. Flitterwochen = 12.230,00 € (via aria-label, animationsunabhängig).
    expect(screen.getByLabelText('12.230,00 €')).toBeInTheDocument();
  });

  it('sollte den Empty-State zeigen, wenn keine Anlässe existieren', () => {
    renderWithProviders(<SpecialCategoriesDesktopView model={emptyModel()} />, { locale: 'de' });
    expect(screen.getByText('Noch keine Anlässe')).toBeInTheDocument();
  });

  it('sollte Unter-Anlässe erst nach dem Aufklappen zeigen (progressive Offenlegung, S3)', () => {
    renderWithProviders(<SpecialCategoriesDesktopView model={buildModel()} />, { locale: 'de' });
    // Vor dem Aufklappen ist das Kind nicht sichtbar.
    expect(screen.queryByText('Flitterwochen')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hochzeit' }));
    expect(screen.getByText('Flitterwochen')).toBeInTheDocument();
  });

  it('sollte onDelete mit der Anlass-ID aufrufen', () => {
    const onDelete = vi.fn();
    renderWithProviders(<SpecialCategoriesDesktopView model={buildModel()} onDelete={onDelete} />, { locale: 'de' });
    fireEvent.click(screen.getByRole('button', { name: 'Löschen: Hochzeit' }));
    expect(onDelete).toHaveBeenCalledWith('hochzeit');
  });

  it('sollte die „Neuer Anlass"-Aktion anbieten', () => {
    const onCreate = vi.fn();
    renderWithProviders(<SpecialCategoriesDesktopView model={buildModel()} onCreate={onCreate} />, { locale: 'de' });
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Anlass' }));
    expect(onCreate).toHaveBeenCalled();
  });
});

describe('SpecialCategoriesDesktopView – Zuordnung aus Vorschlägen (S6/S7, Loop-Schluss)', () => {
  const catsWithWindow: SpecialCategory[] = [
    { id: 'flitter', name: 'Flitterwochen', parent_id: null, start_date: '2026-09-01', end_date: '2026-09-14', lead_days: 14 },
  ];
  const taucher = tx('taucher', -180);
  const txWindow = [taucher];

  function suggestModel(onAssign = vi.fn()): SpecialCategoriesOverviewViewModel {
    const data = buildSpecialCategoriesData(catsWithWindow, [], txWindow);
    return {
      ...data,
      loading: false,
      isEmpty: false,
      suggestionsFor: (id: string) => {
        const cat = catsWithWindow.find((c) => c.id === id);
        return cat ? suggestTransactionsForEvent(cat, txWindow, []) : [];
      },
      actions: { save: vi.fn(), remove: vi.fn(), assign: onAssign, unassign: vi.fn(), saving: false },
    };
  }

  it('sollte den Vorschlag nach Aufklappen zuordnen können', () => {
    const onAssign = vi.fn();
    // taucher (05.09.) liegt im Fenster [18.08., 14.09.]; payee ist 'P' (tx-Helper).
    renderWithProviders(<SpecialCategoriesDesktopView model={suggestModel(onAssign)} onAssign={onAssign} />, { locale: 'de' });
    // Aufklappen offenbart die Vorschläge.
    fireEvent.click(screen.getByRole('button', { name: 'Flitterwochen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Anlass zuordnen: P' }));
    expect(onAssign).toHaveBeenCalledWith('flitter', 'taucher');
  });
});

describe('SpecialCategoriesMobileStory', () => {
  it.each<[Locale, string]>([
    ['de', 'Anlässe'],
    ['en', 'Occasions'],
  ])('sollte als fokussierte Story mit einer Hauptaussage rendern (%s, S13)', (locale, title) => {
    renderWithProviders(<SpecialCategoriesMobileStory model={buildModel()} />, { locale });
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    const total = screen.getByLabelText('12.230,00 €');
    // Hauptaussage ist prominent (größere Schrift als Desktop).
    expect(within(total.closest('li') as HTMLElement).getByText('Hochzeit')).toBeInTheDocument();
  });
});
