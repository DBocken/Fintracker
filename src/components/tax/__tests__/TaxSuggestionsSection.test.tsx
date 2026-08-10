import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/I18nProvider';
import type { Category, Transaction } from '@/types';

vi.mock('@/services/automation-suggestion-service', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/automation-suggestion-service')>();
  return {
    ...original,
    getAutomationSuggestions: vi.fn().mockResolvedValue([]),
    upsertAutomationSuggestion: vi.fn().mockResolvedValue({}),
  };
});
vi.mock('@/services/transaction-service', () => ({
  updateTransaction: vi.fn().mockResolvedValue([]),
  explainCategorization: vi.fn(),
}));

import { TaxSuggestionsSection } from '../TaxSuggestionsSection';
import { upsertAutomationSuggestion } from '@/services/automation-suggestion-service';
import { updateTransaction } from '@/services/transaction-service';
import { asTransactionId } from '@/lib/ids';

let seq = 0;
function tx(overrides: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
  seq += 1;
  return {
    date: '2025-05-10',
    amount: -100,
    payee: `Payee ${seq}`,
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...overrides,
    id: asTransactionId(overrides.id || `tx-${seq}`),
  };
}

// Kategorie mit Steuer-Default ⇒ Vorschlags-Konfidenz 0,9 (sicher).
const HANDWERKER_CAT: Category = {
  id: 'local-cat-handwerker',
  name: 'Handwerker & Reparaturen',
  filters: [],
  attributes: { default_tax_category_id: 'tax-35a3-handwerker' },
};

function renderSection(transactions: Transaction[], categories: Category[] = [HANDWERKER_CAT]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  const rendered = render(
    <QueryClientProvider client={client}>
      <I18nProvider initialLocale="de">
        <TaxSuggestionsSection transactions={transactions} categories={categories} />
      </I18nProvider>
    </QueryClientProvider>,
  );
  return { ...rendered, invalidateSpy };
}

describe('TaxSuggestionsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Normal Behavior', () => {
    it('[REGRESSION] sollte die korrekte Überschrift „Vorschläge prüfen" zeigen (nicht „Nach Steuer-Rubrik")', async () => {
      renderSection([tx({ category_id: 'local-cat-handwerker' })]);
      expect(await screen.findByText('Vorschläge prüfen')).toBeInTheDocument();
      expect(screen.queryByText('Nach Steuer-Rubrik')).not.toBeInTheDocument();
    });

    it('sollte ab zwei sicheren Vorschlägen den Bulk-Button zeigen und alle in einem Batch übernehmen', async () => {
      renderSection([
        tx({ id: 'b1', category_id: 'local-cat-handwerker' }),
        tx({ id: 'b2', category_id: 'local-cat-handwerker' }),
      ]);

      const button = await screen.findByText(/Alle sicheren übernehmen \(2\)/);
      fireEvent.click(button);

      await waitFor(() => {
        // EIN Batch-Call mit beiden Updates — nicht zwei Einzel-Writes.
        expect(updateTransaction).toHaveBeenCalledTimes(1);
        expect(updateTransaction).toHaveBeenCalledWith([
          { id: 'b1', tax_category_id: 'tax-35a3-handwerker' },
          { id: 'b2', tax_category_id: 'tax-35a3-handwerker' },
        ]);
      });
      await waitFor(() => {
        expect(upsertAutomationSuggestion).toHaveBeenCalledTimes(2);
        expect(vi.mocked(upsertAutomationSuggestion).mock.calls.every(([s]) => s.status === 'accepted')).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('sollte den Bulk-Button bei nur EINEM sicheren Vorschlag verbergen', async () => {
      // Ein sicherer (Kategorie-Default 0,9) + ein unsicherer (Keyword 0,7).
      renderSection([
        tx({ id: 'b1', category_id: 'local-cat-handwerker' }),
        tx({ id: 'b2', payee: 'Malerbetrieb Müller' }),
      ]);
      await screen.findByText('Vorschläge prüfen');
      expect(screen.queryByText(/Alle sicheren übernehmen/)).not.toBeInTheDocument();
    });
  });

  describe('Query-Invalidierung (PERF-2, WP 4.2)', () => {
    it('[REGRESSION] sollte beim Ablehnen NICHT die Buchungen invalidieren (nur der Vorschlag ändert sich)', async () => {
      const { invalidateSpy } = renderSection([tx({ id: 'b1', category_id: 'local-cat-handwerker' })]);

      const [item] = await screen.findAllByRole('listitem');
      fireEvent.click(within(item).getByText('Ablehnen'));

      await waitFor(() => {
        expect(upsertAutomationSuggestion).toHaveBeenCalledTimes(1);
        expect(vi.mocked(upsertAutomationSuggestion).mock.calls[0][0].status).toBe('rejected');
      });
      // updateTransaction darf beim Ablehnen gar nicht erst aufgerufen werden —
      // sonst wäre eine Buchungs-Invalidierung berechtigt.
      expect(updateTransaction).not.toHaveBeenCalled();
      expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['transactions'] });
    });

    it('sollte beim Übernehmen weiterhin die Buchungen invalidieren (frische Daten, da tax_category_id sich ändert)', async () => {
      const { invalidateSpy } = renderSection([tx({ id: 'b1', category_id: 'local-cat-handwerker' })]);

      const [item] = await screen.findAllByRole('listitem');
      fireEvent.click(within(item).getByText('Übernehmen'));

      await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['transactions'] }));
    });
  });
});
