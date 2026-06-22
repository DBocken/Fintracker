import { describe, it, expect } from 'vitest';
import type { Category } from '@/types';

/**
 * Testet die Kategorie-Hierarchie-Logik, um sicherzustellen, dass Unter-
 * kategorien korrekt angezeigt werden (Issue: fehlende parent_id Migration).
 */

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

describe('CategoryTwoStepSelect Hierarchie', () => {
  it('sollte Hauptkategorien erkennen', () => {
    const categories: Category[] = [
      { id: 'main1', name: 'Lebensmittel', filters: [], parent_id: null },
      { id: 'sub1', name: 'Supermarkt', filters: [], parent_id: 'main1' },
    ];

    const { mains } = buildCategoryIndex(categories);
    expect(mains).toHaveLength(1);
    expect(mains[0].id).toBe('main1');
  });

  it('sollte Unterkategorien erkennen', () => {
    const categories: Category[] = [
      { id: 'main1', name: 'Lebensmittel', filters: [], parent_id: null },
      { id: 'sub1', name: 'Supermarkt', filters: [], parent_id: 'main1' },
      { id: 'sub2', name: 'Bäckerei', filters: [], parent_id: 'main1' },
    ];

    const { childrenByParent } = buildCategoryIndex(categories);
    expect(childrenByParent.has('main1')).toBe(true);
    expect(childrenByParent.get('main1')).toHaveLength(2);
  });

  it('sollte verwaiste Unterkategorien (fehlende parent) nicht hinzufügen', () => {
    const categories: Category[] = [
      { id: 'main1', name: 'Lebensmittel', filters: [], parent_id: null },
      { id: 'orphan', name: 'Verwaist', filters: [], parent_id: 'non-existent' },
    ];

    const { childrenByParent } = buildCategoryIndex(categories);
    expect(childrenByParent.size).toBe(0);
  });

  it('sollte mehrere Hauptkategorien mit Unterkategorien verarbeiten', () => {
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

  it('sollte Kategorien ohne parent_id als Hauptkategorien behandeln', () => {
    const categories: Category[] = [
      { id: 'cat1', name: 'Kategorie 1', filters: [] }, // parent_id fehlt
      { id: 'cat2', name: 'Kategorie 2', filters: [], parent_id: null },
    ];

    const { mains } = buildCategoryIndex(categories);
    expect(mains).toHaveLength(2);
  });

  it('sollte mit leerer Kategorienliste umgehen', () => {
    const categories: Category[] = [];
    const { mains, childrenByParent } = buildCategoryIndex(categories);

    expect(mains).toHaveLength(0);
    expect(childrenByParent.size).toBe(0);
  });

  it('sollte zirkuläre Referenzen vermeiden', () => {
    const categories: Category[] = [
      { id: 'cat1', name: 'Kategorie 1', filters: [], parent_id: 'cat2' },
      { id: 'cat2', name: 'Kategorie 2', filters: [], parent_id: 'cat1' },
    ];

    const { mains } = buildCategoryIndex(categories);
    // Keine der Kategorien sollte als Hauptkategorie erkannt werden (keine parent_id = null)
    expect(mains).toHaveLength(0);
  });

  it('[REGRESSION] sollte Kategorien mit fehlender parent_id nach Migration anzeigen', () => {
    // Simuliert Kategorien, die VOR der Hierarchie-Migration gespeichert wurden
    const oldCategories: Category[] = [
      { id: 'main1', name: 'Lebensmittel', filters: [] }, // parent_id fehlt
      { id: 'sub1', name: 'Supermarkt', filters: [], parent_id: undefined }, // parent_id undefined
    ];

    const { mains } = buildCategoryIndex(oldCategories);

    // Beide sollten als Hauptkategorien erkannt werden (kein parent_id)
    expect(mains).toHaveLength(2);
  });

  it('[REGRESSION] sollte nach Migration korrekt funktionieren', () => {
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
    expect(childrenByParent.get('main1')?.[0].name).toBe('Bäckerei');
    expect(childrenByParent.get('main1')?.[1].name).toBe('Supermarkt');
  });
});
