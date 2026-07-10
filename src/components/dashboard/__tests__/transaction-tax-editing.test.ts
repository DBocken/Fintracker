import { describe, it, expect } from 'vitest';
import { draftFromTransaction, diffTransactionDraft } from '../transaction-details';
import type { Transaction } from '@/types';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 't1',
    date: '2025-05-10',
    amount: -1800,
    payee: 'Malerbetrieb',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...overrides,
  };
}

describe('Transaction Steuer-Draft/Diff', () => {
  describe('draftFromTransaction', () => {
    it('sollte Steuer-Felder in den Entwurf übernehmen', () => {
      const draft = draftFromTransaction(
        tx({ tax_category_id: 'tax-35a3-handwerker', tax_labor_costs: 1200, tax_note: 'RG 1' }),
      );
      expect(draft.tax_category_id).toBe('tax-35a3-handwerker');
      expect(draft.tax_labor_costs).toBe(1200);
      expect(draft.tax_note).toBe('RG 1');
    });
  });

  describe('diffTransactionDraft', () => {
    it('sollte eine neue Steuer-Markierung ins Patch aufnehmen', () => {
      const original = tx({});
      const draft = { ...draftFromTransaction(original), tax_category_id: 'tax-35a3-handwerker', tax_labor_costs: 1200 };
      const patch = diffTransactionDraft(original, draft);
      expect(patch.tax_category_id).toBe('tax-35a3-handwerker');
      expect(patch.tax_labor_costs).toBe(1200);
    });

    it('[REGRESSION] sollte beim Entfernen der Rubrik auch Arbeitskosten und Notiz nullen', () => {
      const original = tx({ tax_category_id: 'tax-35a3-handwerker', tax_labor_costs: 1200, tax_note: 'RG 1' });
      const draft = { ...draftFromTransaction(original), tax_category_id: null };
      const patch = diffTransactionDraft(original, draft);
      expect(patch.tax_category_id).toBeNull();
      expect(patch.tax_labor_costs).toBeNull();
      expect(patch.tax_note).toBeNull();
    });

    it('sollte keinen Steuer-Patch erzeugen, wenn sich nichts ändert', () => {
      const original = tx({ tax_category_id: 'tax-35a3-handwerker', tax_labor_costs: 1200 });
      const draft = draftFromTransaction(original);
      const patch = diffTransactionDraft(original, draft);
      expect('tax_category_id' in patch).toBe(false);
      expect('tax_labor_costs' in patch).toBe(false);
    });
  });
});
