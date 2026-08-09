import { describe, it, expect } from 'vitest';
import type { Category } from '@/types';
import { migrateIncomeTaxonomy } from '../category-migrations';

/**
 * Testet die Migration der früheren einzelnen "Einkommen"-Hauptkategorie (mit
 * den 4 Unterkategorien Gehalt, Rente & Soziales, Erstattungen, Zinserträge)
 * auf die neue Mehr-Kategorien-Einkommensstruktur.
 */

function legacyIncomeCategories(): Category[] {
  return [
    { id: 'local-cat-einkommen', name: 'Einkommen', filters: [], parent_id: null, is_default: true, attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'local-cat-gehalt', name: 'Gehalt', filters: ['gehalt', 'lohn', 'honorar'], parent_id: 'local-cat-einkommen', is_default: true, attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'local-cat-rentesoziales', name: 'Rente & Soziales', filters: ['rente', 'kindergeld'], parent_id: 'local-cat-einkommen', is_default: true, attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'local-cat-erstattungen', name: 'Erstattungen', filters: ['erstattung'], parent_id: 'local-cat-einkommen', is_default: true, attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'local-cat-zinsertraege', name: 'Zinserträge', filters: ['zinsen'], parent_id: 'local-cat-einkommen', is_default: true, attributes: { ausgabenklasse: 'einkommen' } },
  ];
}

describe('migrateIncomeTaxonomy', () => {
  it('migriert die Legacy-5er-Struktur gemäß Mapping-Tabelle', () => {
    const { categories, changed } = migrateIncomeTaxonomy(legacyIncomeCategories());
    expect(changed).toBe(true);

    const byId = new Map(categories.map((c) => [c.id, c]));

    // local-cat-einkommen → "Sonstige Einnahmen", bleibt Hauptkategorie
    expect(byId.get('local-cat-einkommen')?.name).toBe('Sonstige Einnahmen');
    expect(byId.get('local-cat-einkommen')?.parent_id).toBeNull();

    // local-cat-gehalt → reparented unter Anstellung
    expect(byId.get('local-cat-gehalt')?.parent_id).toBe('local-cat-anstellung');

    // local-cat-rentesoziales → umbenannt + reparented unter Staat & Soziales
    expect(byId.get('local-cat-rentesoziales')?.name).toBe('Rente & Pension');
    expect(byId.get('local-cat-rentesoziales')?.parent_id).toBe('local-cat-staatsoziales');

    // local-cat-erstattungen → befördert zur Hauptkategorie
    expect(byId.get('local-cat-erstattungen')?.parent_id).toBeNull();
    expect(byId.get('local-cat-erstattungen')?.filters).toEqual([]);

    // local-cat-zinsertraege → reparented unter Kapitalerträge
    expect(byId.get('local-cat-zinsertraege')?.parent_id).toBe('local-cat-kapitalertraege');

    // Umgezogene Keywords wurden aus Gehalt entfernt, der Rest bleibt erhalten
    expect(byId.get('local-cat-gehalt')?.filters).toEqual(['gehalt', 'lohn']);

    // Neue Hauptkategorien wurden angehängt
    expect(byId.has('local-cat-anstellung')).toBe(true);
    expect(byId.has('local-cat-staatsoziales')).toBe(true);
    expect(byId.has('local-cat-kapitalertraege')).toBe(true);
    expect(byId.has('local-cat-nebenerwerb')).toBe(true);
    expect(byId.has('local-cat-onlinecreator')).toBe(true);
    expect(byId.has('local-cat-verkaeufe')).toBe(true);
  });

  it('[REGRESSION] ist idempotent — zweiter Lauf ändert nichts (changed === false)', () => {
    const first = migrateIncomeTaxonomy(legacyIncomeCategories());
    expect(first.changed).toBe(true);

    const second = migrateIncomeTaxonomy(first.categories);
    expect(second.changed).toBe(false);
    expect(second.categories).toEqual(first.categories);
  });

  it('[REGRESSION] behält Nutzer-Unterkategorien unter local-cat-einkommen', () => {
    const withUserSub: Category[] = [
      ...legacyIncomeCategories(),
      {
        id: 'custom-nebenjob',
        name: 'Mein Nebenjob',
        filters: ['nebenjobfirma'],
        parent_id: 'local-cat-einkommen',
        is_default: false,
      },
    ];

    const { categories } = migrateIncomeTaxonomy(withUserSub);
    const custom = categories.find((c) => c.id === 'custom-nebenjob');
    expect(custom).toBeDefined();
    expect(custom?.parent_id).toBe('local-cat-einkommen');
    expect(custom?.name).toBe('Mein Nebenjob');
    expect(custom?.filters).toEqual(['nebenjobfirma']);
  });

  it('fasst vom Nutzer überschriebene Kategorien (is_default === false) nicht an', () => {
    const overridden: Category[] = [
      { id: 'local-cat-einkommen', name: 'Einkommen', filters: [], parent_id: null, is_default: true },
      {
        id: 'local-cat-gehalt',
        name: 'Mein Gehalt bei ACME',
        filters: ['acme gmbh'],
        parent_id: 'local-cat-einkommen',
        is_default: false,
      },
    ];

    const { categories } = migrateIncomeTaxonomy(overridden);
    const gehalt = categories.find((c) => c.id === 'local-cat-gehalt');
    // Struktur (Reparenting) wird nachgezogen ...
    expect(gehalt?.parent_id).toBe('local-cat-anstellung');
    // ... aber Name/Filter des Nutzers bleiben unangetastet
    expect(gehalt?.name).toBe('Mein Gehalt bei ACME');
    expect(gehalt?.filters).toEqual(['acme gmbh']);
  });

  it('lässt einen frischen Seed (bereits neue Struktur) unverändert', () => {
    const first = migrateIncomeTaxonomy(legacyIncomeCategories());
    const { categories, changed } = migrateIncomeTaxonomy(first.categories);
    expect(changed).toBe(false);
    expect(categories).toEqual(first.categories);
  });

  it('[REGRESSION] entfernt bei Gehalt/Rente & Soziales nur die umgezogenen Keywords, additiv ergänzte bleiben erhalten', () => {
    // Simuliert einen Zustand, in dem applyCategoryTemplate zusätzlich zum Legacy-
    // Filterstand ein neues Keyword ergänzt hat (additiver Merge, is_default bleibt true).
    const withTemplateAddition: Category[] = [
      { id: 'local-cat-einkommen', name: 'Einkommen', filters: [], parent_id: null, is_default: true },
      {
        id: 'local-cat-gehalt',
        name: 'Gehalt',
        filters: ['gehalt', 'lohn', 'honorar', '__tst_neues_keyword__'],
        parent_id: 'local-cat-einkommen',
        is_default: true,
      },
    ];

    const { categories } = migrateIncomeTaxonomy(withTemplateAddition);
    const gehalt = categories.find((c) => c.id === 'local-cat-gehalt');
    // "honorar" ist umgezogen und wird entfernt, "__tst_neues_keyword__" bleibt erhalten.
    expect(gehalt?.filters).toEqual(['gehalt', 'lohn', '__tst_neues_keyword__']);
  });

  it('local-cat-erstattungen ist nach Beförderung eine Hauptkategorie (parent_id null)', () => {
    const { categories } = migrateIncomeTaxonomy(legacyIncomeCategories());
    const erstattungen = categories.find((c) => c.id === 'local-cat-erstattungen');
    expect(erstattungen?.parent_id).toBeNull();
  });

  it('[REGRESSION] leeres Array: fehlende Einkommens-Defaults werden vollständig angehängt', () => {
    const { categories, changed } = migrateIncomeTaxonomy([]);
    expect(changed).toBe(true);
    const mains = categories.filter((c) => c.parent_id === null);
    expect(mains.every((c) => c.attributes?.ausgabenklasse === 'einkommen')).toBe(true);
    expect(mains.length).toBeGreaterThanOrEqual(8);

    // Zweiter Lauf auf dem Ergebnis ist idempotent
    const second = migrateIncomeTaxonomy(categories);
    expect(second.changed).toBe(false);
  });
});
