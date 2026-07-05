import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import type { Transaction, Category } from '@/types';

beforeAll(() => {
  globalThis.ResizeObserver ||= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const categories: Category[] = [
  { id: 'anstellung', name: 'Anstellung', filters: [], parent_id: null, attributes: { ausgabenklasse: 'einkommen' } },
  { id: 'gehalt', name: 'Gehalt', filters: [], parent_id: 'anstellung', attributes: { ausgabenklasse: 'einkommen' } },
];

let mockTransactions: Transaction[] = [];

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === 'transactions') return { data: mockTransactions, isLoading: false };
    if (queryKey[0] === 'categories') return { data: categories, isLoading: false };
    return { data: undefined, isLoading: false };
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import IncomeStreamsPanel from '../IncomeStreamsPanel';

function renderPanel(locale: 'de' | 'en' = 'de') {
  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter>
        <IncomeStreamsPanel />
      </MemoryRouter>
    </I18nProvider>,
  );
}

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    date: '2024-06-15',
    amount: 0,
    payee: '',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
    ...overrides,
  };
}

describe('IncomeStreamsPanel (IncomePage)', () => {
  it('zeigt den Finanzdaten-Einstieg, wenn noch gar keine Buchungen vorliegen', () => {
    mockTransactions = [];
    renderPanel();
    expect(screen.getAllByText(/Beispieldaten/i).length).toBeGreaterThan(0);
  });

  it('zeigt einen Einnahmen-spezifischen leeren Zustand, wenn Buchungen aber keine Einnahmen vorliegen', () => {
    mockTransactions = [tx({ amount: -50, category_id: 'anstellung' })];
    renderPanel();
    expect(screen.getByText(/Noch keine Einnahmen erfasst/i)).toBeInTheDocument();
  });

  it('zeigt die KPI-Zeile mit Gesamteinnahmen, Anzahl Ströme und größtem Anteil', () => {
    const now = new Date();
    mockTransactions = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return tx({
        id: `s${i}`,
        date: d.toISOString().slice(0, 10),
        amount: 3000,
        payee: 'Muster GmbH',
        description: 'Gehalt',
        category_id: 'anstellung',
        subcategory_id: 'gehalt',
      });
    });
    renderPanel();
    expect(screen.getAllByText(/18\.000/).length).toBeGreaterThan(0);
    // Alle 6 Buchungen bilden EINEN Strom (gleiche Kategorie + gleicher Zahler).
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });
});
