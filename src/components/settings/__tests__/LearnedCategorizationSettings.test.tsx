import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import type { Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';

const getTransactions = vi.fn();
const getCategories = vi.fn();
const getMerchantRules = vi.fn();

vi.mock('@/services/transaction-service', () => ({
  getAllTransactions: (...args: unknown[]) => getTransactions(...args),
  getCategories: () => getCategories(),
}));
vi.mock('@/services/merchant-rules-service', () => ({
  getMerchantRules: () => getMerchantRules(),
}));

import { LearnedCategorizationSettings } from '../LearnedCategorizationSettings';
import { DEFAULT_LOCAL_CATEGORIES } from '@/lib/default-categories';

let seq = 0;
function tx(overrides: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
  seq += 1;
  return {
    date: '2026-03-10',
    amount: -25,
    payee: '',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
    ...overrides,
    id: asTransactionId(overrides.id ?? `lcs-${seq}`),
  };
}

/** Bestätigte Serie eines Händlers, den der Stichwortkatalog NICHT kennt. */
function serie(payee: string, categoryId: string, n: number): Transaction[] {
  return Array.from({ length: n }, (_, i) =>
    tx({
      id: `${categoryId}-${i}`,
      payee: `${payee} ${1000 + i}`,
      category_id: categoryId,
      confirmed: true,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getCategories.mockResolvedValue(DEFAULT_LOCAL_CATEGORIES);
  getMerchantRules.mockResolvedValue([]);
});

describe('LearnedCategorizationSettings', () => {
  it('[ZUSTAND /settings:leer] sollte ohne bestätigte Buchungen erklären, dass noch nichts gelernt ist — statt eine Quote zu behaupten', async () => {
    getTransactions.mockResolvedValue([]);

    renderWithProviders(<LearnedCategorizationSettings />, { locale: 'de', query: true });

    expect(await screen.findByText(/noch zu wenig bestätigt/i)).toBeInTheDocument();
    // Der gefährliche Fehler wäre „0 von 100 richtig" — das klänge nach
    // kaputt, obwohl schlicht nichts gelernt wurde.
    expect(screen.queryByText(/von 100/i)).not.toBeInTheDocument();
  });

  it('[ZUSTAND /settings:fehler] sollte einen Lesefehler benennen, statt eine Quote zu zeigen', async () => {
    getTransactions.mockRejectedValue(new Error('IndexedDB kaputt'));

    renderWithProviders(<LearnedCategorizationSettings />, { locale: 'de', query: true });

    expect(await screen.findByText(/lässt sich gerade nicht laden/i)).toBeInTheDocument();
    expect(screen.queryByText(/von 100/i)).not.toBeInTheDocument();
  });

  it('sollte die gemessene Güte nennen, sobald genug bestätigt wurde', async () => {
    getTransactions.mockResolvedValue([
      ...serie('Zurmiegel Kontor', 'local-cat-lebensmittel', 40),
      ...serie('Ossenkopp Laden', 'local-cat-freizeit', 40),
    ]);

    renderWithProviders(<LearnedCategorizationSettings />, { locale: 'de', query: true });

    expect(await screen.findByText(/von 100 automatisch zugeordneten/i)).toBeInTheDocument();
    expect(screen.getByText(/80 Buchungen, die du selbst bestätigt hast/i)).toBeInTheDocument();
  });

  it('sollte bilingual funktionieren', async () => {
    getTransactions.mockResolvedValue([]);

    renderWithProviders(<LearnedCategorizationSettings />, { locale: 'en', query: true });

    expect(await screen.findByText(/How well does Fintracker sort things\?/i)).toBeInTheDocument();
  });
});
