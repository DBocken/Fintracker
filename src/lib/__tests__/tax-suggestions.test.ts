import { describe, it, expect, beforeEach } from 'vitest';
import { buildPendingTaxSuggestions } from '../tax-suggestions';
import type { AutomationSuggestion } from '@/services/automation-suggestion-service';
import type { Category, Transaction } from '@/types';

beforeEach(() => {
  localStorage.setItem('ausgabentracker_locale_v1', 'de');
});

let seq = 0;
function tx(overrides: Partial<Transaction>): Transaction {
  seq += 1;
  return {
    id: overrides.id || `tx-${seq}`,
    date: '2025-05-10',
    amount: -100,
    payee: '',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...overrides,
  };
}

function cat(id: string, attributes: Category['attributes']): Category {
  return { id, name: id, filters: [], attributes };
}

describe('buildPendingTaxSuggestions', () => {
  describe('Match-Reihenfolge', () => {
    it('sollte den Kategorie-Default vor einem Keyword bevorzugen (0,9)', () => {
      const categories = [cat('local-cat-handwerker', { default_tax_category_id: 'tax-35a3-handwerker' })];
      const txs = [tx({ category_id: 'local-cat-handwerker', payee: 'Spende Betterplace' })];
      const [s] = buildPendingTaxSuggestions(txs, categories, []);
      expect(s.proposedChange.tax_category_id).toBe('tax-35a3-handwerker');
      expect(s.confidence).toBe(0.9);
    });

    it('sollte per Keyword vorschlagen, wenn keine Kategorie-Rubrik gesetzt ist (0,7)', () => {
      const txs = [tx({ payee: 'Malerbetrieb Müller' })];
      const [s] = buildPendingTaxSuggestions(txs, [], []);
      expect(s.proposedChange.tax_category_id).toBe('tax-35a3-handwerker');
      expect(s.confidence).toBe(0.7);
    });

    it('sollte bei steuerrelevant-Flag ohne Rubrik einen „Rubrik wählen"-Vorschlag (0,55) ohne Ziel erzeugen', () => {
      const categories = [cat('local-cat-x', { steuerrelevant: true })];
      const txs = [tx({ category_id: 'local-cat-x', payee: 'Irgendwas' })];
      const [s] = buildPendingTaxSuggestions(txs, categories, []);
      expect(s.confidence).toBe(0.55);
      expect(s.proposedChange.tax_category_id).toBeNull();
    });
  });

  describe('Ausschlüsse', () => {
    it('sollte bereits markierte Buchungen überspringen', () => {
      const txs = [tx({ payee: 'Malerbetrieb', tax_category_id: 'tax-35a3-handwerker' })];
      expect(buildPendingTaxSuggestions(txs, [], [])).toHaveLength(0);
    });

    it('sollte Transfers und Einnahmen überspringen', () => {
      const txs = [
        tx({ payee: 'Malerbetrieb', is_transfer: true }),
        tx({ payee: 'Malerbetrieb', amount: 100 }),
      ];
      expect(buildPendingTaxSuggestions(txs, [], [])).toHaveLength(0);
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte abgelehnte Vorschläge nicht erneut vorschlagen', () => {
      const txs = [tx({ id: 'fix-1', payee: 'Malerbetrieb' })];
      const decided: AutomationSuggestion[] = [
        {
          id: 'tax:fix-1',
          kind: 'tax',
          entityType: 'transaction',
          entityId: 'fix-1',
          title: '',
          description: '',
          confidence: 0.7,
          reasons: [],
          proposedChange: {},
          status: 'rejected',
          created_at: '2025-01-01T00:00:00Z',
        },
      ];
      expect(buildPendingTaxSuggestions(txs, [], decided)).toHaveLength(0);
    });

    it('[REGRESSION] sollte deterministische IDs tax:<txId> erzeugen', () => {
      const txs = [tx({ id: 'fix-2', payee: 'Malerbetrieb' })];
      const [s] = buildPendingTaxSuggestions(txs, [], []);
      expect(s.id).toBe('tax:fix-2');
    });
  });
});
