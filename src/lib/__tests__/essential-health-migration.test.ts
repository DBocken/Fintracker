import { describe, it, expect } from 'vitest';
import { migrateEssentialHealthClasses } from '../category-migrations';
import { DEFAULT_LOCAL_CATEGORIES } from '../default-categories';
import type { Category } from '../../types';

function cat(overrides: Partial<Category>): Category {
  return { id: overrides.id || crypto.randomUUID(), name: 'Kategorie', filters: [], ...overrides };
}

describe('Essenziell-Korrektur: medizinische Therapie & Sehhilfen', () => {
  describe('Neue Defaults', () => {
    it('sollte Therapie als essenziell klassifizieren', () => {
      const therapie = DEFAULT_LOCAL_CATEGORIES.find((c) => c.id === 'local-cat-therapie');
      expect(therapie?.attributes?.ausgabenklasse).toBe('essenziell');
      expect(therapie?.attributes?.essenziell).toBe(true);
    });

    it('sollte Optiker & Hörgeräte als essenziell klassifizieren', () => {
      const optiker = DEFAULT_LOCAL_CATEGORIES.find((c) => c.id === 'local-cat-optikerhoergeraete');
      expect(optiker?.attributes?.ausgabenklasse).toBe('essenziell');
      expect(optiker?.attributes?.essenziell).toBe(true);
    });
  });

  describe('Migration für Bestandsnutzer', () => {
    it('sollte den alten diskretionär-Default auf essenziell heben', () => {
      const stored = [
        cat({
          id: 'local-cat-therapie',
          is_default: true,
          attributes: { ausgabenklasse: 'diskretionaer', essenziell: false },
        }),
      ];
      const { categories, changed } = migrateEssentialHealthClasses(stored);
      expect(changed).toBe(true);
      const therapie = categories.find((c) => c.id === 'local-cat-therapie');
      expect(therapie?.attributes?.ausgabenklasse).toBe('essenziell');
      expect(therapie?.attributes?.essenziell).toBe(true);
    });

    it('[REGRESSION] sollte idempotent sein (F-CAT)', () => {
      const first = migrateEssentialHealthClasses([
        cat({ id: 'local-cat-optikerhoergeraete', is_default: true, attributes: { ausgabenklasse: 'diskretionaer' } }),
      ]);
      const second = migrateEssentialHealthClasses(first.categories);
      expect(second.changed).toBe(false);
    });

    it('[REGRESSION] sollte Nutzer-Overrides nicht anfassen', () => {
      const stored = [
        cat({
          id: 'local-cat-therapie',
          is_default: false,
          attributes: { ausgabenklasse: 'diskretionaer' },
        }),
      ];
      const { categories, changed } = migrateEssentialHealthClasses(stored);
      expect(changed).toBe(false);
      expect(categories[0].attributes?.ausgabenklasse).toBe('diskretionaer');
    });

    it('sollte andere Klassen als diskretionär (bewusste Wahl) nicht überschreiben', () => {
      const stored = [
        cat({ id: 'local-cat-therapie', is_default: true, attributes: { ausgabenklasse: 'sparen' } }),
      ];
      const { changed } = migrateEssentialHealthClasses(stored);
      expect(changed).toBe(false);
    });
  });
});
