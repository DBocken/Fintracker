import { describe, it, expect, beforeEach } from 'vitest';
import { explainCategorization, categorizeTransactionConfident } from '@/lib/categorization';
import type { MerchantRule } from '@/lib/categorization';
import { trainCategoryModel, withClassPrecision, MIN_KLASSEN_SUPPORT } from '@/lib/category-model';
import { DEFAULT_LOCAL_CATEGORIES } from '@/lib/default-categories';
import type { Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';

beforeEach(() => {
  localStorage.setItem('ausgabentracker_locale_v1', 'de');
});

let seq = 0;
function tx(overrides: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
  seq += 1;
  return {
    date: '2026-03-10',
    amount: -25,
    payee: '',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
    ...overrides,
    id: asTransactionId(overrides.id ?? `cwm-${seq}`),
  };
}

/** Bestätigte Serie in einer Kategorie, die es in DEFAULT_LOCAL_CATEGORIES gibt. */
function serie(payee: string, categoryId: string, n: number, amount = -25): Transaction[] {
  return Array.from({ length: n }, (_, i) =>
    tx({
      id: `${categoryId}-${i}`,
      payee: `${payee} ${1000 + i}`,
      amount,
      category_id: categoryId,
      confirmed: true,
    }),
  );
}

/** Ein einsatzbereites Modell inkl. Gate-3-Präzision. */
function bewertetesModell(transactions: Transaction[], rules: MerchantRule[] = []) {
  const roh = trainCategoryModel(transactions, rules);
  return withClassPrecision(roh, new Map(roh.klassen.map((k) => [k, 0.97])));
}

const LEBENSMITTEL = 'local-cat-lebensmittel';

describe('Kaskade mit gelerntem Modell', () => {
  it('sollte ohne bestätigte Buchungen exakt dasselbe Ergebnis liefern wie ohne Modell', () => {
    // Das Nicht-Regressions-Versprechen für Neunutzer: Wer nichts bestätigt
    // hat, merkt von WP-B nichts — über die GANZE Kategorien-Matrix geprüft,
    // nicht an einem Beispiel.
    const leeresModell = bewertetesModell([]);
    const proben = [
      tx({ payee: 'REWE Markt', amount: -40 }),
      tx({ payee: 'Shell Tankstelle', amount: -70 }),
      tx({ payee: 'Bausparverein Schwäbisch Hall', amount: -100 }),
      tx({ payee: 'DEPOT Deko GmbH Filiale 12', amount: -30 }),
      tx({ payee: 'GetFit GmbH', amount: -25 }),
      tx({ payee: 'Voellig Unbekannter Empfaenger', amount: -13 }),
      tx({ payee: 'Arbeitgeber Lohn', amount: 2400 }),
    ];

    for (const probe of proben) {
      const ohne = explainCategorization(probe, DEFAULT_LOCAL_CATEGORIES);
      const mit = explainCategorization(probe, DEFAULT_LOCAL_CATEGORIES, [], { model: leeresModell });
      expect(mit).toEqual(ohne);
    }
  });

  it('sollte eine ausdrückliche Händlerregel dem gelernten Modell vorziehen', () => {
    const model = bewertetesModell(serie('Kiosk am Eck', LEBENSMITTEL, 30));
    const regeln: MerchantRule[] = [
      { id: 'r1', user_id: 'local', merchant_pattern: 'kiosk am eck', category_id: 'local-cat-freizeit' },
    ];

    const ergebnis = explainCategorization(
      tx({ payee: 'Kiosk am Eck 4711' }),
      DEFAULT_LOCAL_CATEGORIES,
      regeln,
      { model },
    );

    expect(ergebnis.source).toBe('merchant_rule');
    expect(ergebnis.categoryId).toBe('local-cat-freizeit');
  });

  it('sollte eine gelernte Zuordnung NICHT still schreiben, solange zu wenige Beispiele vorliegen', () => {
    const model = bewertetesModell(serie('Zurmiegel Kontor', LEBENSMITTEL, MIN_KLASSEN_SUPPORT - 1));
    const probe = tx({ payee: 'Zurmiegel Kontor 4711' });

    const ergebnis = explainCategorization(probe, DEFAULT_LOCAL_CATEGORIES, [], { model });

    expect(ergebnis.source).toBe('learned_model');
    expect(ergebnis.confidence).toBeLessThan(0.7);
    expect(categorizeTransactionConfident(probe, DEFAULT_LOCAL_CATEGORIES, [], { model })).toBeNull();
  });

  it('sollte einen Händler zuordnen, den nur der Nutzer kennt', () => {
    // Genau der Gewinn des Pakets: „Zurmiegel Kontor" steht in keinem
    // Stichwortkatalog und in keiner Fallback-Regel — nachgeprüft, die Kaskade
    // allein liefert dafür `null`.
    const model = bewertetesModell(serie('Zurmiegel Kontor', LEBENSMITTEL, 30));
    const probe = tx({ payee: 'Zurmiegel Kontor 4711' });

    const ohne = explainCategorization(probe, DEFAULT_LOCAL_CATEGORIES);
    const mit = explainCategorization(probe, DEFAULT_LOCAL_CATEGORIES, [], { model });

    expect(ohne.categoryId).toBeNull();
    expect(mit.categoryId).toBe(LEBENSMITTEL);
    expect(mit.source).toBe('learned_model');
    expect(mit.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('sollte eine Begründung liefern, die den Beleg nennt statt einer Prozentzahl', () => {
    const model = bewertetesModell(serie('Zurmiegel Kontor', LEBENSMITTEL, 30));

    const ergebnis = explainCategorization(
      tx({ payee: 'Zurmiegel Kontor 4711' }),
      DEFAULT_LOCAL_CATEGORIES,
      [],
      { model },
    );

    expect(ergebnis.reasons).toHaveLength(1);
    expect(ergebnis.reasons[0]).toContain('30');
    expect(ergebnis.reasons[0]).toContain('zurmiegel');
    expect(ergebnis.reasons[0]).not.toMatch(/%/);
  });

  it('sollte eine inzwischen gelöschte Kategorie nicht wiederauferstehen lassen', () => {
    const model = bewertetesModell(serie('Zurmiegel Kontor', 'local-cat-existiert-nicht-mehr', 30));

    const ergebnis = explainCategorization(
      tx({ payee: 'Zurmiegel Kontor 4711' }),
      DEFAULT_LOCAL_CATEGORIES,
      [],
      { model },
    );

    expect(ergebnis.source).not.toBe('learned_model');
    expect(ergebnis.categoryId).not.toBe('local-cat-existiert-nicht-mehr');
  });

  it('[REGRESSION] sollte die Präzisions-Pins auch mit trainiertem Modell halten', () => {
    // Die drei Fälle aus `categorization-precision.test.ts`. Ein Modell, das
    // auf ganz anderen Händlern trainiert wurde, darf sie nicht kippen.
    const model = bewertetesModell([
      ...serie('Zurmiegel Kontor', LEBENSMITTEL, 30),
      ...serie('Stadtwerke Abschlag', 'local-cat-strom', 30, -95),
    ]);
    const kontext = { model };

    expect(
      explainCategorization(tx({ payee: 'Bausparverein Schwäbisch Hall' }), DEFAULT_LOCAL_CATEGORIES, [], kontext)
        .categoryId,
    ).not.toBe('local-cat-vereine');
    expect(
      explainCategorization(tx({ payee: 'DEPOT Deko GmbH Filiale 12' }), DEFAULT_LOCAL_CATEGORIES, [], kontext)
        .categoryId,
    ).not.toBe('local-cat-wertpapiere');
    expect(
      explainCategorization(tx({ payee: 'GetFit GmbH' }), DEFAULT_LOCAL_CATEGORIES, [], kontext).categoryId,
    ).not.toBe('local-cat-wertpapiere');
  });
});
