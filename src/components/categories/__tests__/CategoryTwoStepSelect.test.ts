import { describe, it, expect } from 'vitest';
import type { Category } from '@/types';

/**
 * CategoryTwoStepSelect Hierarchie-Tests
 *
 * Testet die Kategorie-Hierarchie-Logik der UI-Komponente, die für die
 * Anzeige von Haupt-/Unterkategorien bei Transaktionen verantwortlich ist.
 *
 * Context: Issue wurde verursacht durch fehlende `parent_id` bei Kategorien,
 *         die vor der Migration 20260614120000 gespeichert wurden.
 */

// Helper: Baut Index für schnelle Hierarchie-Lookups
function buildCategoryIndex(categories: Category[]) {
  const byId = new Map<string, Category>();
  const childrenByParent = new Map<string, Category[]>();
  const mains: Category[] = [];

  for (const c of categories) {
    byId.set(c.id, c);
  }

  for (const c of categories) {
    if (!c.parent_id) {
      mains.push(c);
    } else {
      if (byId.has(c.parent_id)) {
        const arr = childrenByParent.get(c.parent_id) || [];
        arr.push(c);
        childrenByParent.set(c.parent_id, arr);
      }
    }
  }

  mains.sort((a, b) => a.name.localeCompare(b.name));
  for (const arr of childrenByParent.values()) {
    arr.sort((a, b) => a.name.localeCompare(b.name));
  }

  return { byId, childrenByParent, mains };
}

describe('CategoryTwoStepSelect - Hierarchie-Logik', () => {
  // ============================================================================
  // Gruppe 1: Normales Verhalten
  // ============================================================================
  describe('Normale Hierarchie-Erkennung', () => {
    it('sollte Hauptkategorien (parent_id === null) erkennen', () => {
      const categories: Category[] = [
        { id: 'main1', name: 'Lebensmittel', filters: [], parent_id: null },
        { id: 'sub1', name: 'Supermarkt', filters: [], parent_id: 'main1' },
      ];

      const { mains } = buildCategoryIndex(categories);
      expect(mains).toHaveLength(1);
      expect(mains[0].id).toBe('main1');
    });

    it('sollte Unterkategorien (parent_id gesetzt) erkennen und zuordnen', () => {
      const categories: Category[] = [
        { id: 'main1', name: 'Lebensmittel', filters: [], parent_id: null },
        { id: 'sub1', name: 'Supermarkt', filters: [], parent_id: 'main1' },
        { id: 'sub2', name: 'Bäckerei', filters: [], parent_id: 'main1' },
      ];

      const { childrenByParent } = buildCategoryIndex(categories);
      expect(childrenByParent.has('main1')).toBe(true);
      expect(childrenByParent.get('main1')).toHaveLength(2);
    });

    it('sollte mehrere Hauptkategorien mit unterschiedlichen Unterkategorien verarbeiten', () => {
      const categories: Category[] = [
        { id: 'main1', name: 'Lebensmittel', filters: [], parent_id: null },
        { id: 'sub1a', name: 'Supermarkt', filters: [], parent_id: 'main1' },
        { id: 'main2', name: 'Wohnen', filters: [], parent_id: null },
        { id: 'sub2a', name: 'Miete', filters: [], parent_id: 'main2' },
        { id: 'sub2b', name: 'Energie', filters: [], parent_id: 'main2' },
      ];

      const { mains, childrenByParent } = buildCategoryIndex(categories);
      expect(mains).toHaveLength(2);
      expect(childrenByParent.get('main1')).toHaveLength(1);
      expect(childrenByParent.get('main2')).toHaveLength(2);
    });
  });

  // ============================================================================
  // Gruppe 2: Edge Cases & Robustheit
  // ============================================================================
  describe('Edge Cases', () => {
    it('sollte Kategorien ohne parent_id-Feld (undefined) als Hauptkategorien behandeln', () => {
      const categories: Category[] = [
        { id: 'cat1', name: 'Kategorie 1', filters: [] },
        { id: 'cat2', name: 'Kategorie 2', filters: [], parent_id: null },
      ];

      const { mains } = buildCategoryIndex(categories);
      expect(mains).toHaveLength(2);
    });

    it('sollte leere Kategorienlisten korrekt verarbeiten', () => {
      const categories: Category[] = [];
      const { mains, childrenByParent } = buildCategoryIndex(categories);

      expect(mains).toHaveLength(0);
      expect(childrenByParent.size).toBe(0);
    });

    it('sollte verwaiste Unterkategorien ignorieren (parent existiert nicht)', () => {
      const categories: Category[] = [
        { id: 'main1', name: 'Lebensmittel', filters: [], parent_id: null },
        { id: 'orphan', name: 'Verwaist', filters: [], parent_id: 'non-existent' },
      ];

      const { childrenByParent } = buildCategoryIndex(categories);
      expect(childrenByParent.size).toBe(0);
    });

    it('sollte zirkuläre Referenzen vermeiden (Kategorie mit sich selbst verlinkt)', () => {
      const categories: Category[] = [
        { id: 'cat1', name: 'Kategorie 1', filters: [], parent_id: 'cat2' },
        { id: 'cat2', name: 'Kategorie 2', filters: [], parent_id: 'cat1' },
      ];

      const { mains } = buildCategoryIndex(categories);
      expect(mains).toHaveLength(0);
    });
  });

  // ============================================================================
  // Gruppe 3: Regression Protection
  // ============================================================================
  describe('[REGRESSION] Parent_ID Migration', () => {
    it('sollte alte Kategorien ohne parent_id korrekt als Hauptkategorien identifizieren', () => {
      // Simuliert Kategorien VOR der Migration 20260614120000_restructure_categories_hierarchy
      const oldCategories: Category[] = [
        { id: 'main1', name: 'Lebensmittel', filters: [] },
        { id: 'sub1', name: 'Supermarkt', filters: [], parent_id: undefined },
      ];

      const { mains } = buildCategoryIndex(oldCategories);
      expect(mains).toHaveLength(2);
    });

    it('sollte nach parent_id-Migration korrekt funktionieren', () => {
      // Simuliert Kategorien NACH der Migration (parent_id wurde nachgefüllt)
      const migratedCategories: Category[] = [
        { id: 'main1', name: 'Lebensmittel', filters: [], parent_id: null },
        { id: 'sub1', name: 'Supermarkt', filters: [], parent_id: 'main1' },
        { id: 'sub2', name: 'Bäckerei', filters: [], parent_id: 'main1' },
      ];

      const { mains, childrenByParent } = buildCategoryIndex(migratedCategories);

      expect(mains).toHaveLength(1);
      expect(mains[0].id).toBe('main1');
      expect(childrenByParent.get('main1')).toHaveLength(2);
      // Sortiert: Bäckerei kommt vor Supermarkt alphabetisch
      expect(childrenByParent.get('main1')?.[0].name).toBe('Bäckerei');
      expect(childrenByParent.get('main1')?.[1].name).toBe('Supermarkt');
    });
  });
});
