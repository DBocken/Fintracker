import { describe, it, expect } from 'vitest';
import { migrateInsuranceTaxSplit } from '../local-settings-service';
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

describe('Versicherungs-Split (Steuer-Präzision)', () => {
  describe('Neue Defaults (buildDefaultCategories)', () => {
    it('sollte die Misch-Kategorie zu "Hausrat & Gebäude" OHNE Steuer-Default machen', () => {
      const hausrat = DEFAULT_LOCAL_CATEGORIES.find((c) => c.id === 'local-cat-haftpflichthausrat');
      expect(hausrat?.name).toBe('Hausrat & Gebäude');
      // Hausrat/Wohngebäude sind steuerlich NICHT absetzbar → kein Vorschlags-Default.
      expect(hausrat?.attributes?.default_tax_category_id).toBeUndefined();
      expect(hausrat?.filters).not.toContain('haftpflicht');
    });

    it('sollte eine eigene Haftpflicht-Kategorie MIT Steuer-Default liefern', () => {
      const haftpflicht = DEFAULT_LOCAL_CATEGORIES.find((c) => c.id === 'local-cat-haftpflicht');
      expect(haftpflicht?.name).toBe('Haftpflichtversicherung');
      expect(haftpflicht?.attributes?.default_tax_category_id).toBe('tax-so-versicherungen');
      expect(haftpflicht?.filters).toContain('haftpflicht');
    });

    it('sollte Vereine OHNE Spenden-Default liefern (Beiträge oft nicht gemeinnützig)', () => {
      const vereine = DEFAULT_LOCAL_CATEGORIES.find((c) => c.id === 'local-cat-vereine');
      expect(vereine?.attributes?.default_tax_category_id).toBeUndefined();
      expect(vereine?.attributes?.steuerrelevant).toBeUndefined();
    });
  });

  describe('Migration für Bestandsnutzer', () => {
    const legacyMixed = () =>
      cat({
        id: 'local-cat-haftpflichthausrat',
        name: 'Haftpflicht & Hausrat',
        is_default: true,
        filters: ['haftpflicht', 'hausratversicherung', 'wohngebäudeversicherung'],
        attributes: { steuerrelevant: true, default_tax_category_id: 'tax-so-versicherungen' },
      });

    const legacyVereine = () =>
      cat({
        id: 'local-cat-vereine',
        name: 'Vereine',
        is_default: true,
        filters: ['verein', 'mitgliedsbeitrag'],
        attributes: { steuerrelevant: true, default_tax_category_id: 'tax-so-spenden' },
      });

    it('sollte die Misch-Kategorie umbenennen, Steuer-Default entfernen und Haftpflicht anhängen', () => {
      const { categories, changed } = migrateInsuranceTaxSplit([legacyMixed()]);

      expect(changed).toBe(true);
      const mixed = categories.find((c) => c.id === 'local-cat-haftpflichthausrat');
      expect(mixed?.name).toBe('Hausrat & Gebäude');
      expect(mixed?.attributes?.default_tax_category_id).toBeNull();
      expect(mixed?.attributes?.steuerrelevant).toBe(false);
      expect(mixed?.filters).not.toContain('haftpflicht');
      expect(mixed?.filters).toContain('hausratversicherung');

      const haftpflicht = categories.find((c) => c.id === 'local-cat-haftpflicht');
      expect(haftpflicht?.attributes?.default_tax_category_id).toBe('tax-so-versicherungen');
    });

    it('sollte den Vereine-Spenden-Default entfernen', () => {
      const { categories, changed } = migrateInsuranceTaxSplit([legacyVereine()]);
      expect(changed).toBe(true);
      const vereine = categories.find((c) => c.id === 'local-cat-vereine');
      expect(vereine?.attributes?.default_tax_category_id).toBeNull();
      expect(vereine?.attributes?.steuerrelevant).toBe(false);
    });

    it('[REGRESSION] sollte idempotent sein (zweiter Lauf ändert nichts, F-CAT)', () => {
      const first = migrateInsuranceTaxSplit([legacyMixed(), legacyVereine()]);
      const second = migrateInsuranceTaxSplit(first.categories);
      expect(second.changed).toBe(false);
    });

    it('[REGRESSION] sollte Nutzer-Overrides (is_default === false) nicht anfassen', () => {
      const userOverride = cat({
        id: 'local-cat-haftpflichthausrat',
        name: 'Meine Versicherungen',
        is_default: false,
        filters: ['haftpflicht'],
        attributes: { default_tax_category_id: 'tax-so-versicherungen' },
      });
      const { categories } = migrateInsuranceTaxSplit([userOverride]);
      const kept = categories.find((c) => c.id === 'local-cat-haftpflichthausrat');
      expect(kept?.name).toBe('Meine Versicherungen');
      expect(kept?.attributes?.default_tax_category_id).toBe('tax-so-versicherungen');
      expect(kept?.filters).toContain('haftpflicht');
      // Die neue Haftpflicht-Kategorie kommt trotzdem dazu (additiv, kein Konflikt).
      expect(categories.some((c) => c.id === 'local-cat-haftpflicht')).toBe(true);
    });

    it('sollte einen vom Nutzer bewusst gesetzten anderen Steuer-Default nicht überschreiben', () => {
      const custom = cat({
        id: 'local-cat-vereine',
        name: 'Vereine',
        is_default: true,
        filters: ['verein'],
        // Nutzer hat z. B. bewusst auf Parteispenden umgestellt.
        attributes: { default_tax_category_id: 'tax-so-parteispenden' },
      });
      const { categories } = migrateInsuranceTaxSplit([custom]);
      const vereine = categories.find((c) => c.id === 'local-cat-vereine');
      expect(vereine?.attributes?.default_tax_category_id).toBe('tax-so-parteispenden');
    });
  });
});
