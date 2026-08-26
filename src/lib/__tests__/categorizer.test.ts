import { describe, expect, it } from 'vitest';
import {
  createCategorizer,
  explainCategorization,
  MIN_SILENT_ASSIGN_CONFIDENCE,
} from '@/lib/categorization';
import type { MerchantRule } from '@/lib/categorization';
import { asTransactionId } from '@/lib/ids';
import type { Category, Transaction } from '@/types';

/**
 * Vorbereiteter Kategorisierer (`createCategorizer`): derselbe Befund wie die
 * Einzelfunktion, aber der Kategorie-Index wird EINMAL gebaut statt je Buchung.
 *
 * Der zweite Test ist der eigentliche Wächter und bewusst OHNE Uhr formuliert:
 * er zählt die Zugriffe auf die Kategorien und verlangt, dass ihre Zahl NICHT
 * von der Zahl der Buchungen abhängt. Eine Zeitmessung würde dieselbe Aussage
 * nur mit CI-Rauschen treffen (die Laufzeit-Gegenprobe steht separat in
 * `categorizer.perf.test.ts`).
 */

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    date: '2026-01-15',
    amount: -10,
    payee: '',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
    ...overrides,
  };
}

function category(overrides: Partial<Category>): Category {
  return { id: 'cat', name: 'Kategorie', filters: [], ...overrides };
}

/**
 * Kategorien, die jeden Lesezugriff auf `filters` und `attributes` mitzählen.
 * Damit ist die Frage „einmal oder je Buchung?" beobachtbar, ohne die
 * Implementierung zu mocken.
 */
function countingCategories(count: number) {
  const reads = { filters: 0, attributes: 0 };
  const categories: Category[] = Array.from({ length: count }, (_, i) => {
    const filters = [`haendler${i}`, `marke-${i}-gmbh`];
    const attributes = i % 5 === 0 ? { ausgabenklasse: 'einkommen' as const } : undefined;
    const base = { id: `cat-${i}`, name: `Kategorie ${i}`, parent_id: null };
    return Object.defineProperties({ ...base } as Category, {
      filters: {
        get() {
          reads.filters += 1;
          return filters;
        },
        enumerable: true,
      },
      attributes: {
        get() {
          reads.attributes += 1;
          return attributes;
        },
        enumerable: true,
      },
    });
  });
  return { categories, reads };
}

function corpus(count: number): Transaction[] {
  return Array.from({ length: count }, (_, i) =>
    tx({
      id: asTransactionId(`tx-${i}`),
      amount: i % 7 === 0 ? 120.5 : -(i % 90) - 1,
      payee: `Haendler${i % 40} Filiale ${i}`,
      description: `Kartenzahlung marke-${i % 25}-gmbh`,
      original_text: `SEPA LASTSCHRIFT HAENDLER${i % 40}`,
    }),
  );
}

describe('createCategorizer', () => {
  it('sollte für jede Buchung dasselbe Ergebnis liefern wie explainCategorization', () => {
    const { categories } = countingCategories(30);
    const learnedRules: MerchantRule[] = [
      { id: 'r1', user_id: 'local', merchant_pattern: 'haendler7', category_id: 'cat-3' },
      { id: 'r2', user_id: 'local', merchant_pattern: 'haendler7 filiale', category_id: 'cat-9' },
    ];
    const categorizer = createCategorizer(categories, learnedRules);

    for (const row of corpus(300)) {
      expect(categorizer.explain(row)).toEqual(
        explainCategorization(row, categories, learnedRules),
      );
    }
  });

  it('sollte die Kategorien einmal lesen, nicht je Buchung', () => {
    const wenige = countingCategories(50);
    const categorizerWenige = createCategorizer(wenige.categories);
    for (const row of corpus(50)) categorizerWenige.explain(row);

    const viele = countingCategories(50);
    const categorizerViele = createCategorizer(viele.categories);
    for (const row of corpus(500)) categorizerViele.explain(row);

    // Zehnmal so viele Buchungen, identisch viele Kategorie-Zugriffe: der Index
    // hängt an der Kategorienliste, nicht am Bestand.
    expect(viele.reads).toEqual(wenige.reads);
    expect(wenige.reads.filters).toBeLessThanOrEqual(50);
  });

  it('sollte die Regex-Fallback-Kategorie über den Index finden statt die Liste zu durchsuchen', () => {
    const categories = [
      category({ id: 'local-cat-lebensmittel', name: 'Lebensmittel' }),
      category({ id: 'local-cat-sonstiges', name: 'Sonstiges' }),
    ];
    const result = createCategorizer(categories).explain(tx({ payee: 'Supermarkt am Eck' }));

    expect(result.source).toBe('regex_fallback');
    expect(result.categoryId).toBe('local-cat-lebensmittel');
    expect(result.confidence).toBeLessThan(MIN_SILENT_ASSIGN_CONFIDENCE);
  });

  it('sollte Einkommens-Kategorien für Ausgaben weiterhin sperren (Richtungs-Guard)', () => {
    const categories = [
      category({
        id: 'einnahmen',
        name: 'Verkäufe',
        filters: ['ebay'],
        attributes: { ausgabenklasse: 'einkommen' },
      }),
    ];
    const categorizer = createCategorizer(categories);

    expect(categorizer.explain(tx({ amount: -30, payee: 'ebay' })).categoryId).not.toBe('einnahmen');
    expect(categorizer.explain(tx({ amount: 30, payee: 'ebay' })).categoryId).toBe('einnahmen');
  });

  it('sollte den Richtungs-Guard über die Kategorie-Hierarchie auflösen', () => {
    const categories = [
      category({ id: 'oben', name: 'Einnahmen', attributes: { ausgabenklasse: 'einkommen' } }),
      category({ id: 'unten', name: 'Verkäufe', filters: ['ebay'], parent_id: 'oben' }),
    ];
    const categorizer = createCategorizer(categories);

    expect(categorizer.explain(tx({ amount: -30, payee: 'ebay' })).categoryId).not.toBe('unten');
    expect(categorizer.explain(tx({ amount: 30, payee: 'ebay' })).categoryId).toBe('unten');
  });

  it('sollte auch die abgeleiteten Formen anbieten (categorize/categorizeConfident)', () => {
    const categories = [category({ id: 'lebensmittel', filters: ['rewe'] })];
    const categorizer = createCategorizer(categories);

    expect(categorizer.categorize(tx({ payee: 'REWE Markt GmbH' }))).toBe('lebensmittel');
    expect(categorizer.categorizeConfident(tx({ payee: 'REWE Markt GmbH' }))).toBe('lebensmittel');
    // Regex-Fallback (0,55) liegt unter dem Floor für stille Zuweisung.
    expect(
      createCategorizer([category({ id: 'local-cat-lebensmittel' })]).categorizeConfident(
        tx({ payee: 'Supermarkt am Eck' }),
      ),
    ).toBeNull();
  });

  it('sollte mit leerer Kategorienliste kein Ergebnis behaupten', () => {
    const result = createCategorizer([]).explain(tx({ payee: 'REWE Markt GmbH' }));
    expect(result.categoryId).toBeNull();
    expect(result.source).toBe('none');
  });
});
