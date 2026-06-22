import { describe, it, expect } from 'vitest';
import type { Category } from '@/types';

/**
 * Testet die parent_id-Migration für Kategorien, die vor der Hierarchie-
 * Umstrukturierung gespeichert wurden (Issue: fehlende Unterkategorien).
 */

describe('Category Hierarchy Migration', () => {
  const DEFAULT_CATEGORIES_MOCK: Category[] = [
    { id: 'local-cat-einkommen', name: 'Einkommen', filters: [], parent_id: null },
    { id: 'local-cat-gehalt', name: 'Gehalt', filters: [], parent_id: 'local-cat-einkommen' },
    { id: 'local-cat-wohnen', name: 'Wohnen', filters: [], parent_id: null },
    { id: 'local-cat-miete', name: 'Miete & Hausgeld', filters: [], parent_id: 'local-cat-wohnen' },
    { id: 'local-cat-energie', name: 'Strom & Energie', filters: [], parent_id: 'local-cat-wohnen' },
    { id: 'local-cat-lebensmittel', name: 'Lebensmittel', filters: [], parent_id: null },
    { id: 'local-cat-supermarkt', name: 'Supermarkt', filters: [], parent_id: 'local-cat-lebensmittel' },
  ];

  function migrateParentIds(stored: Category[]): Category[] {
    return stored.map((cat) => {
      // Wenn parent_id bereits gesetzt (null oder string), nicht verändern
      if (cat.parent_id !== undefined) return cat;
      // Sonst: versuche aus Default-Kategorien zu laden
      const defaultCat = DEFAULT_CATEGORIES_MOCK.find((d) => d.id === cat.id);
      const resolvedParentId = defaultCat?.parent_id ?? null;
      return { ...cat, parent_id: resolvedParentId };
    });
  }

  it('sollte Kategorien ohne parent_id migrieren', () => {
    const oldCategories: Category[] = [
      { id: 'local-cat-lebensmittel', name: 'Lebensmittel', filters: [] },
      { id: 'local-cat-supermarkt', name: 'Supermarkt', filters: [] },
    ];

    const migrated = migrateParentIds(oldCategories);

    expect(migrated[0].parent_id).toBeNull();
    expect(migrated[1].parent_id).toBe('local-cat-lebensmittel');
  });

  it('sollte Kategorien mit undefined parent_id migrieren', () => {
    const oldCategories: Category[] = [
      { id: 'local-cat-wohnen', name: 'Wohnen', filters: [], parent_id: undefined },
      { id: 'local-cat-miete', name: 'Miete & Hausgeld', filters: [], parent_id: undefined },
    ];

    const migrated = migrateParentIds(oldCategories);

    expect(migrated[0].parent_id).toBeNull();
    expect(migrated[1].parent_id).toBe('local-cat-wohnen');
  });

  it('sollte bereits migrierte Kategorien nicht verändern', () => {
    const migratedCategories: Category[] = [
      { id: 'local-cat-lebensmittel', name: 'Lebensmittel', filters: [], parent_id: null },
      { id: 'local-cat-supermarkt', name: 'Supermarkt', filters: [], parent_id: 'local-cat-lebensmittel' },
    ];

    const result = migrateParentIds(migratedCategories);

    expect(result[0].parent_id).toBeNull();
    expect(result[1].parent_id).toBe('local-cat-lebensmittel');
  });

  it('sollte benutzerdefinierte Kategorien (nicht in defaults) mit null parent_id belassen', () => {
    const customCategories: Category[] = [
      { id: 'custom-1', name: 'Meine eigene Kategorie', filters: [] },
    ];

    const migrated = migrateParentIds(customCategories);

    expect(migrated[0].parent_id).toBeNull();
  });

  it('sollte gemischte alte und neue Kategorien korrekt migrieren', () => {
    const mixedCategories: Category[] = [
      // Alte Kategorien ohne parent_id
      { id: 'local-cat-lebensmittel', name: 'Lebensmittel', filters: [] },
      { id: 'local-cat-supermarkt', name: 'Supermarkt', filters: [] },
      // Neue Kategorien mit parent_id
      { id: 'local-cat-wohnen', name: 'Wohnen', filters: [], parent_id: null },
      { id: 'local-cat-miete', name: 'Miete & Hausgeld', filters: [], parent_id: 'local-cat-wohnen' },
      // Benutzerdefinierte
      { id: 'custom-1', name: 'Custom', filters: [] },
    ];

    const migrated = migrateParentIds(mixedCategories);

    expect(migrated[0].parent_id).toBeNull();
    expect(migrated[1].parent_id).toBe('local-cat-lebensmittel');
    expect(migrated[2].parent_id).toBeNull();
    expect(migrated[3].parent_id).toBe('local-cat-wohnen');
    expect(migrated[4].parent_id).toBeNull();
  });

  it('[REGRESSION] sollte leere Kategorienarray verarbeiten', () => {
    const empty: Category[] = [];
    const result = migrateParentIds(empty);
    expect(result).toHaveLength(0);
  });

  it('[REGRESSION] sollte mehrere Unterkategorien unter gleicher Parent migrieren', () => {
    const oldCategories: Category[] = [
      { id: 'local-cat-wohnen', name: 'Wohnen', filters: [] },
      { id: 'local-cat-miete', name: 'Miete & Hausgeld', filters: [] },
      { id: 'local-cat-energie', name: 'Strom & Energie', filters: [] },
    ];

    const migrated = migrateParentIds(oldCategories);

    expect(migrated[0].parent_id).toBeNull();
    expect(migrated[1].parent_id).toBe('local-cat-wohnen');
    expect(migrated[2].parent_id).toBe('local-cat-wohnen');
  });
});
