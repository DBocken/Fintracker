import { describe, it, expect } from 'vitest';
import { backfillAusgabenklasse } from '../local-settings-service';
import { DEFAULT_LOCAL_CATEGORIES } from '../default-categories';
import type { Category } from '@/types';

/**
 * Tests für den Bestands-Backfill der Ausgabenklasse.
 *
 * Hintergrund: Kategorien, die vor Einführung der `ausgabenklasse` geseedet
 * wurden, haben das Attribut nicht. Ohne Backfill zeigt das Sunburst nur
 * "essenziell"/"unkategorisiert". Der Backfill rüstet die Werte aus den
 * Default-Kategorien nach.
 */

// Eine bekannte Default-Hauptkategorie (essenziell) als Referenz.
const wohnenDefault = DEFAULT_LOCAL_CATEGORIES.find((c) => c.id === 'local-cat-wohnen');
const einkommenDefault = DEFAULT_LOCAL_CATEGORIES.find((c) => c.id === 'local-cat-einkommen');

describe('backfillAusgabenklasse', () => {
  it('Test-Fixtures: Default-Kategorien haben eine Ausgabenklasse', () => {
    expect(wohnenDefault?.attributes?.ausgabenklasse).toBe('essenziell');
    expect(einkommenDefault?.attributes?.ausgabenklasse).toBe('einkommen');
  });

  it('füllt fehlende ausgabenklasse aus der Default-Kategorie (per ID) nach', () => {
    // Simuliert alte Bestandsdaten: gleiche ID, aber ohne ausgabenklasse.
    const stored: Category[] = [
      {
        id: 'local-cat-wohnen',
        name: 'Wohnen',
        filters: [],
        attributes: { essenziell: true }, // kein ausgabenklasse
      },
    ];

    const { categories, changed } = backfillAusgabenklasse(stored);

    expect(changed).toBe(true);
    expect(categories[0].attributes?.ausgabenklasse).toBe('essenziell');
  });

  it('erbt die ausgabenklasse von der Hauptkategorie für Unterkategorien', () => {
    const stored: Category[] = [
      {
        id: 'local-cat-wohnen',
        name: 'Wohnen',
        filters: [],
        attributes: { ausgabenklasse: 'essenziell' },
      },
      {
        id: 'user-custom-sub',
        name: 'Eigene Unterkategorie',
        parent_id: 'local-cat-wohnen',
        filters: [],
        attributes: {}, // kein ausgabenklasse
      },
    ];

    const { categories, changed } = backfillAusgabenklasse(stored);

    expect(changed).toBe(true);
    const sub = categories.find((c) => c.id === 'user-custom-sub');
    expect(sub?.attributes?.ausgabenklasse).toBe('essenziell');
  });

  it('lässt bereits gesetzte ausgabenklasse unangetastet', () => {
    const stored: Category[] = [
      {
        id: 'local-cat-wohnen',
        name: 'Wohnen',
        filters: [],
        attributes: { ausgabenklasse: 'sparen' }, // bewusst abweichend
      },
    ];

    const { categories, changed } = backfillAusgabenklasse(stored);

    expect(changed).toBe(false);
    expect(categories[0].attributes?.ausgabenklasse).toBe('sparen');
  });

  it('lässt unbekannte Kategorien ohne Match unverändert (changed bleibt false)', () => {
    const stored: Category[] = [
      {
        id: 'völlig-unbekannt',
        name: 'Mystery',
        filters: [],
        attributes: {},
      },
    ];

    const { categories, changed } = backfillAusgabenklasse(stored);

    expect(changed).toBe(false);
    expect(categories[0].attributes?.ausgabenklasse).toBeUndefined();
  });

  it('rüstet einen kompletten Satz alter Bestandskategorien nach (mehrere Klassen)', () => {
    // Default-Kategorien ohne ausgabenklasse (wie alter Seed).
    const stored: Category[] = DEFAULT_LOCAL_CATEGORIES.map((c) => ({
      ...c,
      attributes: { essenziell: c.attributes?.essenziell },
    }));

    const { categories, changed } = backfillAusgabenklasse(stored);

    expect(changed).toBe(true);
    // Jede Kategorie, die im Default eine Klasse hat, ist nachgerüstet.
    const klassen = new Set(
      categories.map((c) => c.attributes?.ausgabenklasse).filter(Boolean)
    );
    // Erwartet mindestens essenziell, diskretionaer, sparen, einkommen.
    expect(klassen.has('essenziell')).toBe(true);
    expect(klassen.has('einkommen')).toBe(true);
    expect(klassen.size).toBeGreaterThanOrEqual(3);
  });
});
