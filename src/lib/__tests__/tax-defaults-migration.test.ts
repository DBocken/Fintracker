import { describe, it, expect } from 'vitest';
import { backfillTaxDefaults } from '../category-migrations';
import { DEFAULT_LOCAL_CATEGORIES } from '../default-categories';
import type { Category } from '../../types';

function cat(overrides: Partial<Category>): Category {
  return {
    id: overrides.id || crypto.randomUUID(),
    name: 'Kategorie',
    filters: [],
    ...overrides,
  };
}

// Bereits vorhandene neue Steuer-Subkategorien, damit der Append-Pfad in
// isolierten Tests kein `changed` auslöst (fokussiert die Behaviour-Prüfung).
const NEW_TAX_SUBCATS = ['local-cat-handwerker', 'local-cat-haushaltsdienste', 'local-cat-spenden'].map(
  (id) => cat({ id, is_default: true, attributes: { default_tax_category_id: 'x' } }),
);

describe('backfillTaxDefaults', () => {
  describe('Normal Behavior', () => {
    it('sollte default_tax_category_id auf bestehenden Default-Kategorien nachrüsten', () => {
      const stored = [cat({ id: 'local-cat-arztzahnarzt', is_default: true, attributes: { essenziell: true } })];
      const { categories, changed } = backfillTaxDefaults(stored);

      expect(changed).toBe(true);
      const arzt = categories.find((c) => c.id === 'local-cat-arztzahnarzt');
      expect(arzt?.attributes?.default_tax_category_id).toBe('tax-agb-krankheit');
      expect(arzt?.attributes?.steuerrelevant).toBe(true);
    });

    it('sollte fehlende neue Default-Subkategorien anhängen', () => {
      // Bestand ohne die neue Handwerker-Kategorie.
      const stored = [cat({ id: 'local-cat-wohnen', is_default: true, parent_id: null })];
      const { categories, changed } = backfillTaxDefaults(stored);

      expect(changed).toBe(true);
      const handwerker = categories.find((c) => c.id === 'local-cat-handwerker');
      expect(handwerker).toBeDefined();
      expect(handwerker?.attributes?.default_tax_category_id).toBe('tax-35a3-handwerker');
    });

    it('sollte Kategorien ohne Steuer-Default unangetastet lassen', () => {
      const stored = [cat({ id: 'local-cat-supermarkt', is_default: true, attributes: { essenziell: true } })];
      const { categories } = backfillTaxDefaults(stored);
      const supermarkt = categories.find((c) => c.id === 'local-cat-supermarkt');
      expect(supermarkt?.attributes?.default_tax_category_id).toBeUndefined();
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte beim zweiten Lauf nichts mehr ändern (Idempotenz, F-CAT)', () => {
      const stored = DEFAULT_LOCAL_CATEGORIES.map((c) => ({ ...c }));
      const first = backfillTaxDefaults(stored);
      // Defaults tragen ihre Rubrik bereits — nichts zu tun.
      expect(first.changed).toBe(false);

      const second = backfillTaxDefaults(first.categories);
      expect(second.changed).toBe(false);
    });

    it('[REGRESSION] sollte Nutzer-Overrides (is_default === false) nicht anfassen', () => {
      const stored = [
        cat({ id: 'local-cat-arztzahnarzt', is_default: false, attributes: { essenziell: true } }),
        ...NEW_TAX_SUBCATS,
      ];
      const { categories, changed } = backfillTaxDefaults(stored);

      expect(changed).toBe(false);
      const arzt = categories.find((c) => c.id === 'local-cat-arztzahnarzt');
      expect(arzt?.attributes?.default_tax_category_id).toBeUndefined();
    });

    it('[REGRESSION] sollte einen bereits gesetzten Wert (auch null) nicht überschreiben', () => {
      const stored = [
        cat({
          id: 'local-cat-arztzahnarzt',
          is_default: true,
          attributes: { essenziell: true, default_tax_category_id: null },
        }),
        ...NEW_TAX_SUBCATS,
      ];
      const { categories, changed } = backfillTaxDefaults(stored);

      expect(changed).toBe(false);
      const arzt = categories.find((c) => c.id === 'local-cat-arztzahnarzt');
      expect(arzt?.attributes?.default_tax_category_id).toBeNull();
    });
  });
});
