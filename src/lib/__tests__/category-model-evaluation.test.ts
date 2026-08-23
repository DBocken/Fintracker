import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateCategorizationModel } from '@/lib/category-model-evaluation';
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
    id: asTransactionId(overrides.id ?? `ev-${seq}`),
  };
}

/** Bestätigte Serie mit fortlaufenden Daten (für den chronologischen Schnitt). */
function serie(payee: string, categoryId: string, n: number, amount = -25, jahr = 2026): Transaction[] {
  return Array.from({ length: n }, (_, i) =>
    tx({
      id: `${categoryId}-${payee}-${i}`,
      payee: `${payee} ${1000 + i}`,
      amount,
      date: `${jahr}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      category_id: categoryId,
      confirmed: true,
    }),
  );
}

describe('evaluateCategorizationModel', () => {
  it('sollte bei zu dünner Datenlage keine Zahlen behaupten', () => {
    const bericht = evaluateCategorizationModel(
      serie('Zurmiegel Kontor', 'local-cat-lebensmittel', 4),
      DEFAULT_LOCAL_CATEGORIES,
    );

    expect(bericht.bewertet).toBe(4);
    expect(bericht.mitModell.oberhalbSchwelle).toBe(0);
    expect(bericht.klassenPraezision.size).toBe(0);
  });

  it('sollte unbestätigte Buchungen gar nicht erst bewerten', () => {
    const bericht = evaluateCategorizationModel(
      Array.from({ length: 40 }, (_, i) =>
        tx({ id: `a-${i}`, payee: `Irgendwer ${i}`, category_id: 'local-cat-lebensmittel', auto_mapped: true }),
      ),
      DEFAULT_LOCAL_CATEGORIES,
    );

    expect(bericht.bewertet).toBe(0);
  });

  it('sollte für nur dem Nutzer bekannte Händler eine bessere Abdeckung ausweisen als die Kaskade', () => {
    // Der Kern der Messung: Diese Händler stehen in keinem Stichwortkatalog.
    // Ohne Modell findet die Kaskade nichts, mit Modell findet sie sie wieder.
    const buchungen = [
      ...serie('Zurmiegel Kontor', 'local-cat-lebensmittel', 40),
      ...serie('Ossenkopp Laden', 'local-cat-freizeit', 40, -60),
    ];

    const bericht = evaluateCategorizationModel(buchungen, DEFAULT_LOCAL_CATEGORIES);

    expect(bericht.bewertet).toBe(80);
    expect(bericht.mitModell.abdeckung).toBeGreaterThan(bericht.ohneModell.abdeckung);
    expect(bericht.mitModell.praezision).toBeGreaterThan(0.9);
  });

  it('sollte eine Klassen-Präzision nur für ausreichend belegte Klassen ausweisen', () => {
    // Eine Präzision aus zwei Beobachtungen ist eine Zufallszahl — und Gate 3
    // nähme sie für bare Münze.
    const bericht = evaluateCategorizationModel(
      [
        ...serie('Zurmiegel Kontor', 'local-cat-lebensmittel', 40),
        ...serie('Tannenbeck Handel', 'local-cat-freizeit', 3, -60),
      ],
      DEFAULT_LOCAL_CATEGORIES,
    );

    expect(bericht.klassenPraezision.has('local-cat-freizeit')).toBe(false);
  });

  it('sollte zusätzlich chronologisch schneiden', () => {
    // Zufälliges Splitten verzerrt bei wiederkehrenden Händlern optimistisch:
    // derselbe Einkauf läge sonst in Trainings- UND Testmenge.
    const bericht = evaluateCategorizationModel(
      serie('Zurmiegel Kontor', 'local-cat-lebensmittel', 40),
      DEFAULT_LOCAL_CATEGORIES,
    );

    expect(bericht.chronologisch).not.toBeNull();
    expect(bericht.chronologisch!.mitModell.oberhalbSchwelle).toBeGreaterThan(0);
  });

  it('sollte reproduzierbar sein — dieselbe Eingabe ergibt denselben Bericht', () => {
    const buchungen = serie('Zurmiegel Kontor', 'local-cat-lebensmittel', 40);

    const a = evaluateCategorizationModel(buchungen, DEFAULT_LOCAL_CATEGORIES);
    const b = evaluateCategorizationModel([...buchungen].reverse(), DEFAULT_LOCAL_CATEGORIES);

    expect(a.mitModell).toEqual(b.mitModell);
    expect(a.ohneModell).toEqual(b.ohneModell);
  });
});
