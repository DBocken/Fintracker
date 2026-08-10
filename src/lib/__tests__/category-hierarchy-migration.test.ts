import { describe, it, expect } from 'vitest';
import type { Category } from '@/types';
import { migrateParentIds } from '../category-migrations';

/**
 * Testet die parent_id-Migration für Kategorien, die vor der Hierarchie-
 * Umstrukturierung gespeichert wurden (Issue: fehlende Unterkategorien).
 *
 * Nutzt echte lokale Default-Kategorien-IDs (local-cat-wohnen/-miete/-stromenergie/
 * -lebensmittel/-supermarkt) statt einer selbst gepflegten Kopie der Default-Liste —
 * diese war bereits von der echten Taxonomie abgedriftet (z.B. existiert
 * "local-cat-energie" nicht, real heißt es "local-cat-stromenergie") und rief
 * außerdem eine lokal reimplementierte Kopie von migrateParentIds auf, statt die
 * echte Funktion aus local-settings-service zu testen.
 */
describe('Category Hierarchy Migration', () => {
  it('sollte Kategorien ohne parent_id migrieren', () => {
    const oldCategories: Category[] = [
      { id: 'local-cat-lebensmittel', name: 'Lebensmittel', filters: [] },
      { id: 'local-cat-supermarkt', name: 'Supermarkt', filters: [] },
    ];

    const { categories: migrated } = migrateParentIds(oldCategories);

    expect(migrated[0].parent_id).toBeNull();
    expect(migrated[1].parent_id).toBe('local-cat-lebensmittel');
  });

  it('sollte Kategorien mit undefined parent_id migrieren', () => {
    const oldCategories: Category[] = [
      { id: 'local-cat-wohnen', name: 'Wohnen', filters: [], parent_id: undefined },
      { id: 'local-cat-miete', name: 'Miete & Hausgeld', filters: [], parent_id: undefined },
    ];

    const { categories: migrated } = migrateParentIds(oldCategories);

    expect(migrated[0].parent_id).toBeNull();
    expect(migrated[1].parent_id).toBe('local-cat-wohnen');
  });

  it('sollte bereits migrierte Kategorien nicht verändern', () => {
    const migratedCategories: Category[] = [
      { id: 'local-cat-lebensmittel', name: 'Lebensmittel', filters: [], parent_id: null },
      { id: 'local-cat-supermarkt', name: 'Supermarkt', filters: [], parent_id: 'local-cat-lebensmittel' },
    ];

    const { categories: result } = migrateParentIds(migratedCategories);

    expect(result[0].parent_id).toBeNull();
    expect(result[1].parent_id).toBe('local-cat-lebensmittel');
  });

  it('sollte benutzerdefinierte Kategorien (nicht in defaults) mit null parent_id belassen', () => {
    const customCategories: Category[] = [
      { id: 'custom-1', name: 'Meine eigene Kategorie', filters: [] },
    ];

    const { categories: migrated } = migrateParentIds(customCategories);

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

    const { categories: migrated } = migrateParentIds(mixedCategories);

    expect(migrated[0].parent_id).toBeNull();
    expect(migrated[1].parent_id).toBe('local-cat-lebensmittel');
    expect(migrated[2].parent_id).toBeNull();
    expect(migrated[3].parent_id).toBe('local-cat-wohnen');
    expect(migrated[4].parent_id).toBeNull();
  });

  it('[REGRESSION] sollte leere Kategorienarray verarbeiten', () => {
    const empty: Category[] = [];
    const { categories: result } = migrateParentIds(empty);
    expect(result).toHaveLength(0);
  });

  it('[REGRESSION] sollte mehrere Unterkategorien unter gleicher Parent migrieren', () => {
    const oldCategories: Category[] = [
      { id: 'local-cat-wohnen', name: 'Wohnen', filters: [] },
      { id: 'local-cat-miete', name: 'Miete & Hausgeld', filters: [] },
      { id: 'local-cat-stromenergie', name: 'Strom & Energie', filters: [] },
    ];

    const { categories: migrated } = migrateParentIds(oldCategories);

    expect(migrated[0].parent_id).toBeNull();
    expect(migrated[1].parent_id).toBe('local-cat-wohnen');
    expect(migrated[2].parent_id).toBe('local-cat-wohnen');
  });
});
