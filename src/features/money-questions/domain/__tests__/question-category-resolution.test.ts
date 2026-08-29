import { describe, it, expect, beforeEach } from 'vitest';
import { resolveKategorieAusText } from '@/features/money-questions/domain/question-category-resolution';
import { trainCategoryModel, withClassPrecision } from '@/lib/category-model';
import { DEFAULT_LOCAL_CATEGORIES } from '@/lib/default-categories';
import type { MerchantRule } from '@/lib/categorization';
import type { Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';

beforeEach(() => {
  localStorage.setItem('ausgabentracker_locale_v1', 'de');
});

let seq = 0;
function tx(o: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
  seq += 1;
  return {
    date: '2026-03-10',
    amount: -25,
    payee: '',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
    ...o,
    id: asTransactionId(o.id ?? `qcr-${seq}`),
  };
}

function serie(payee: string, categoryId: string, n: number): Transaction[] {
  return Array.from({ length: n }, (_, i) =>
    tx({ id: `${categoryId}-${i}`, payee: `${payee} ${1000 + i}`, category_id: categoryId, confirmed: true }),
  );
}

/**
 * Abstrakte Begriffe auf eine Kategorie abbilden.
 *
 * Das ist der Kern der Chat-Bedienung: Wer „für essen" tippt, meint seine
 * Kategorie „Essen & Trinken" — auch wenn er sie nicht beim Namen nennt. Der
 * reine Namensvergleich kann das nie: Er verlangt, dass der GETIPPTE Text den
 * Kategorienamen enthält, und ein kürzerer, abstrakterer Begriff ist per
 * Definition kürzer als der Name.
 *
 * Aufgelöst wird über dieselbe Engine, die auch Buchungen kategorisiert —
 * kuratierte deutsche Stichwörter, eigene Händlerregeln, gelerntes Modell.
 * Damit verbessert sich die Chat-Erkennung automatisch mit, wenn die
 * Kategorisierung besser wird.
 */
describe('resolveKategorieAusText', () => {
  it('sollte ein Wort des Kategorienamens zuordnen', () => {
    const treffer = resolveKategorieAusText('essen', DEFAULT_LOCAL_CATEGORIES);
    expect(treffer?.categoryId).toBe('local-cat-essenundtrinken');
  });

  it('sollte ein kuratiertes Stichwort zuordnen, das kein Kategoriename ist', () => {
    // „tanken" steht als Stichwort unter Kraftstoff — nirgends im Namen.
    expect(resolveKategorieAusText('tanken', DEFAULT_LOCAL_CATEGORIES)?.categoryId).toBe(
      'local-cat-kraftstoff',
    );
    expect(resolveKategorieAusText('parken', DEFAULT_LOCAL_CATEGORIES)?.categoryId).toBe(
      'local-cat-parken',
    );
  });

  it('sollte einen Händler über das kuratierte Vokabular zuordnen', () => {
    expect(resolveKategorieAusText('pizzeria', DEFAULT_LOCAL_CATEGORIES)?.categoryId).toBe(
      'local-cat-restaurant',
    );
  });

  it('sollte einen Begriff über das GELERNTE Modell zuordnen', () => {
    // „Zurmiegel Kontor" steht in keinem Katalog — nur in den eigenen
    // bestätigten Buchungen. Genau dafür ist der Klassifikator da.
    const roh = trainCategoryModel(serie('Zurmiegel Kontor', 'local-cat-lebensmittel', 30));
    const model = withClassPrecision(roh, new Map(roh.klassen.map((k) => [k, 0.97])));

    const treffer = resolveKategorieAusText('zurmiegel', DEFAULT_LOCAL_CATEGORIES, [], { model });

    expect(treffer?.categoryId).toBe('local-cat-lebensmittel');
  });

  it('sollte eine eigene Händlerregel zuordnen', () => {
    const regeln: MerchantRule[] = [
      { id: 'r1', user_id: 'local', merchant_pattern: 'kiosk am eck', category_id: 'local-cat-freizeit' },
    ];
    expect(resolveKategorieAusText('kiosk am eck', DEFAULT_LOCAL_CATEGORIES, regeln)?.categoryId).toBe(
      'local-cat-freizeit',
    );
  });

  it('sollte bei einem unbekannten Begriff NICHTS zuordnen', () => {
    // Lieber nachfragen als raten — dieselbe Regel wie überall auf der Fläche.
    expect(resolveKategorieAusText('quastelhuber', DEFAULT_LOCAL_CATEGORIES)).toBeNull();
  });

  it('sollte bei leerem Text nichts zuordnen', () => {
    expect(resolveKategorieAusText('   ', DEFAULT_LOCAL_CATEGORIES)).toBeNull();
  });

  it('sollte melden, worauf die Zuordnung beruht', () => {
    // Die Fläche muss sagen können, was sie verstanden hat — sonst ist eine
    // erratene Kategorie eine stille Falschaussage.
    const treffer = resolveKategorieAusText('tanken', DEFAULT_LOCAL_CATEGORIES);
    expect(treffer?.source).toBe('category_filter');
    expect(treffer?.confidence).toBeGreaterThan(0);
  });

  it('sollte eine Einkommens-Kategorie nicht über die Richtung ausschliessen', () => {
    // Der Richtungs-Guard der Kaskade gilt für Buchungen, nicht für eine
    // Frage: „wieviel habe ich mit gehalt eingenommen" darf Gehalt treffen.
    expect(resolveKategorieAusText('gehalt', DEFAULT_LOCAL_CATEGORIES)?.categoryId).toBeTruthy();
  });
});
