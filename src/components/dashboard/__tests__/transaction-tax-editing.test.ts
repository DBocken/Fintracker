import { describe, it, expect } from 'vitest';
import { draftFromTransaction, diffTransactionDraft, buildDetailTaxDefault } from '../transaction-details';
import type { Category, Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';

function tx(overrides: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
  return {
    date: '2025-05-10',
    amount: -1800,
    payee: 'Malerbetrieb',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...overrides,
    // `id`: ausdrueckliches `id: undefined` MUSS undefined bleiben (WP 5.2b).
    // Vor dem Brand stand die Vorgabe VOR dem Spread, ein `undefined` aus
    // den Overrides hat sie also ueberschrieben. Nur das FEHLEN des
    // Schluessels faellt auf die Vorgabe zurueck.
    id: 'id' in overrides
      ? (overrides.id === undefined ? undefined : asTransactionId(overrides.id))
      : asTransactionId('t1'),
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

  describe('buildDetailTaxDefault (Steuer-Default-Chip)', () => {
    const handwerkerCat: Category = {
      id: 'local-cat-handwerker',
      name: 'Handwerker & Reparaturen',
      filters: [],
      parent_id: 'local-cat-wohnen',
      attributes: { default_tax_category_id: 'tax-35a3-handwerker' },
    };
    const wohnenCat: Category = { id: 'local-cat-wohnen', name: 'Wohnen', filters: [], parent_id: null };
    const byId = new Map([
      [handwerkerCat.id, handwerkerCat],
      [wohnenCat.id, wohnenCat],
    ]);

    it('sollte den Kategorie-Default vorschlagen, wenn die Buchung unmarkiert ist', () => {
      const draft = draftFromTransaction(
        tx({ category_id: 'local-cat-wohnen', subcategory_id: 'local-cat-handwerker' }),
      );
      const suggestion = buildDetailTaxDefault(draft, -1800, byId);
      expect(suggestion?.taxCategoryId).toBe('tax-35a3-handwerker');
      expect(suggestion?.categoryName).toBe('Handwerker & Reparaturen');
    });

    it('sollte NICHT vorschlagen, wenn bereits eine Rubrik gesetzt ist', () => {
      const draft = {
        ...draftFromTransaction(tx({ subcategory_id: 'local-cat-handwerker' })),
        tax_category_id: 'tax-agb-krankheit',
      };
      expect(buildDetailTaxDefault(draft, -1800, byId)).toBeNull();
    });

    it('sollte NICHT vorschlagen, wenn die Kategorie keinen Default trägt', () => {
      const draft = draftFromTransaction(tx({ category_id: 'local-cat-wohnen' }));
      expect(buildDetailTaxDefault(draft, -1800, byId)).toBeNull();
    });

    it('sollte NICHT für Einnahmen oder Transfers vorschlagen', () => {
      const draft = draftFromTransaction(tx({ subcategory_id: 'local-cat-handwerker' }));
      expect(buildDetailTaxDefault(draft, 200, byId)).toBeNull();
      const transferDraft = { ...draft, is_transfer: true };
      expect(buildDetailTaxDefault(transferDraft, -1800, byId)).toBeNull();
    });

    it('sollte einen unbekannten Default (gelöschte Steuer-Kategorie) ignorieren', () => {
      const broken: Category = {
        ...handwerkerCat,
        attributes: { default_tax_category_id: 'tax-gibt-es-nicht' },
      };
      const draft = draftFromTransaction(tx({ subcategory_id: broken.id }));
      expect(buildDetailTaxDefault(draft, -1800, new Map([[broken.id, broken]]))).toBeNull();
    });
  });
});
