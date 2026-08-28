import { describe, it, expect } from 'vitest';
import {
  trainCategoryModel,
  predictCategory,
  extractCategoryFeatures,
  withClassPrecision,
  MIN_KLASSEN_SUPPORT,
  MIN_EVIDENZ_SUPPORT,
} from '@/lib/category-model';
import type { Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';

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
    id: asTransactionId(overrides.id ?? `cm-${seq}`),
  };
}

/** `n` bestätigte Buchungen desselben Händlers in derselben Kategorie. */
function bestaetigteSerie(payee: string, categoryId: string, n: number, amount = -25): Transaction[] {
  return Array.from({ length: n }, (_, i) =>
    tx({
      id: `${categoryId}-${payee}-${i}`,
      payee: `${payee} ${1000 + i}`,
      amount,
      date: `2026-0${(i % 9) + 1}-1${i % 10}`,
      category_id: categoryId,
      confirmed: true,
    }),
  );
}

describe('extractCategoryFeatures', () => {
  it('sollte Tokens mit Herkunftspräfix erzeugen', () => {
    const merkmale = extractCategoryFeatures(
      tx({ payee: 'LIDL SAGT DANKE 1234', description: 'Wocheneinkauf' }),
    );

    // Der Empfängername ist ein anderes Signal als der Verwendungszweck —
    // dasselbe Wort darf an beiden Stellen nicht dasselbe Gewicht haben.
    expect(merkmale).toContain('p:lidl');
    expect(merkmale).toContain('d:wocheneinkauf');
    expect(merkmale).not.toContain('p:wocheneinkauf');
  });

  it('sollte reine Ziffernfolgen und Kürzestwörter verwerfen', () => {
    const merkmale = extractCategoryFeatures(tx({ payee: 'OK 12 Rewe 998877' }));

    expect(merkmale).toContain('p:rewe');
    // Nur die WORT-Merkmale dürfen keine Ziffern tragen; `band:20_50` ist ein
    // Pseudotoken und meint eine Größenordnung, keine Zeichenkette aus dem Text.
    const woerter = merkmale.filter((m) => /^[pdo]:/.test(m));
    expect(woerter.some((m) => /\d/.test(m))).toBe(false);
    expect(merkmale).not.toContain('p:ok');
  });

  it('sollte Richtung und Betragsband als eigene Merkmale führen', () => {
    const ausgabe = extractCategoryFeatures(tx({ payee: 'Rewe', amount: -25 }));
    const einnahme = extractCategoryFeatures(tx({ payee: 'Rewe', amount: 25 }));

    expect(ausgabe).toContain('dir:out');
    expect(einnahme).toContain('dir:in');
    expect(ausgabe.some((m) => m.startsWith('band:'))).toBe(true);
    // Gleicher Betrag, andere Richtung ⇒ dasselbe Band.
    const bandA = ausgabe.find((m) => m.startsWith('band:'));
    const bandB = einnahme.find((m) => m.startsWith('band:'));
    expect(bandA).toBe(bandB);
  });
});

describe('trainCategoryModel', () => {
  it('sollte NUR aus bestätigten Buchungen lernen', () => {
    // Der wichtigste Test des Pakets: Lernte das Modell aus `auto_mapped`,
    // wäre seine eigene Ausgabe seine Eingabe — jeder Fehler der Kaskade
    // verstärkte sich und käme mit HÖHERER Konfidenz zurück.
    const automatisch = Array.from({ length: 40 }, (_, i) =>
      tx({
        id: `auto-${i}`,
        payee: `Fantasiehaendler ${1000 + i}`,
        category_id: 'local-cat-falsch',
        auto_mapped: true,
        confirmed: false,
      }),
    );

    const model = trainCategoryModel(automatisch);

    expect(model.klassen).toHaveLength(0);
    expect(predictCategory(model, tx({ payee: 'Fantasiehaendler 9999' }))).toBeNull();
  });

  it('sollte den Händler aus bestätigten Buchungen wiedererkennen', () => {
    const model = trainCategoryModel([
      ...bestaetigteSerie('Lidl', 'local-cat-lebensmittel', 20),
      ...bestaetigteSerie('Allianz Versicherung', 'local-cat-versicherung', 20, -90),
    ]);

    const treffer = predictCategory(model, tx({ payee: 'Lidl 4711', amount: -31 }));

    expect(treffer?.categoryId).toBe('local-cat-lebensmittel');
    expect(treffer?.marge).toBeGreaterThan(0);
  });

  it('sollte gegen eine stark unbalancierte Klassenverteilung bestehen', () => {
    // Complement-NB statt Standard-NB: Bei 60 Lebensmittel- gegen 14
    // Versicherungsbuchungen kippt Standard-NB zur häufigsten Klasse.
    const model = trainCategoryModel([
      ...bestaetigteSerie('Lidl', 'local-cat-lebensmittel', 60),
      ...bestaetigteSerie('Allianz Versicherung', 'local-cat-versicherung', 14, -90),
    ]);

    const treffer = predictCategory(model, tx({ payee: 'Allianz Versicherung 5555', amount: -90 }));

    expect(treffer?.categoryId).toBe('local-cat-versicherung');
  });

  it('sollte reproduzierbar sein: gleiche Eingabe, gleiches Modell', () => {
    const buchungen = [
      ...bestaetigteSerie('Lidl', 'local-cat-lebensmittel', 15),
      ...bestaetigteSerie('Shell', 'local-cat-tanken', 15, -70),
    ];
    const gemischt = [...buchungen].reverse();

    const a = predictCategory(trainCategoryModel(buchungen), tx({ payee: 'Shell 1' , amount: -70 }));
    const b = predictCategory(trainCategoryModel(gemischt), tx({ payee: 'Shell 1', amount: -70 }));

    expect(a).toEqual(b);
  });

  it('sollte Händlerregeln als ausdrückliche Nutzerentscheidung mitlernen', () => {
    const model = trainCategoryModel(bestaetigteSerie('Lidl', 'local-cat-lebensmittel', 20), [
      {
        id: 'r1',
        user_id: 'local',
        merchant_pattern: 'kfz meisterbetrieb',
        category_id: 'local-cat-auto',
      },
    ]);

    expect(model.klassen).toContain('local-cat-auto');
  });

  it('sollte Evidenz-Tokens für eine belegbare Begründung liefern', () => {
    const model = trainCategoryModel(bestaetigteSerie('Lidl', 'local-cat-lebensmittel', 20));

    const treffer = predictCategory(model, tx({ payee: 'Lidl 4711' }));

    // Nicht „Wahrscheinlichkeit 87 %", sondern worauf die Zuordnung beruht.
    expect(treffer?.evidenz).toContain('lidl');
    expect(treffer?.support).toBe(20);
  });
});

describe('Gates gegen stille Fehlzuweisung', () => {
  it('sollte unterhalb des Klassen-Supports nicht als sicher gelten', () => {
    const zuWenig = MIN_KLASSEN_SUPPORT - 1;
    const model = trainCategoryModel(bestaetigteSerie('Lidl', 'local-cat-lebensmittel', zuWenig));

    const treffer = predictCategory(model, tx({ payee: 'Lidl 4711' }));

    expect(treffer?.categoryId).toBe('local-cat-lebensmittel');
    expect(treffer?.sicher).toBe(false);
  });

  it('sollte ohne wiederholte Evidenz nicht als sicher gelten', () => {
    // Genug Beispiele der Klasse, aber das Wort der neuen Buchung kam nur
    // ein einziges Mal vor — eine Zuordnung aus einem Zufallswort.
    const serie = bestaetigteSerie('Lidl', 'local-cat-lebensmittel', MIN_KLASSEN_SUPPORT + 5);
    serie[0] = tx({
      ...serie[0],
      id: 'einmalig',
      payee: 'Sonderposten Restever',
      category_id: 'local-cat-lebensmittel',
      confirmed: true,
    });
    const model = trainCategoryModel(serie);

    const treffer = predictCategory(model, tx({ payee: 'Sonderposten Restever' }));

    expect(treffer?.evidenzStaerke).toBeLessThan(MIN_EVIDENZ_SUPPORT);
    expect(treffer?.sicher).toBe(false);
  });

  it('sollte ohne bekannte Klassen-Präzision nicht als sicher gelten', () => {
    // Gate 3: Solange nicht kreuzvalidiert ist, wie oft diese Klasse
    // danebenliegt, darf nichts still geschrieben werden.
    const roh = trainCategoryModel(bestaetigteSerie('Lidl', 'local-cat-lebensmittel', 30));

    expect(predictCategory(roh, tx({ payee: 'Lidl 4711' }))?.sicher).toBe(false);

    const bewertet = withClassPrecision(roh, new Map([['local-cat-lebensmittel', 0.97]]));
    expect(predictCategory(bewertet, tx({ payee: 'Lidl 4711' }))?.sicher).toBe(true);
  });

  it('sollte eine Klasse mit schlechter Präzision nicht still schreiben lassen', () => {
    const roh = trainCategoryModel(bestaetigteSerie('Lidl', 'local-cat-lebensmittel', 30));
    const bewertet = withClassPrecision(roh, new Map([['local-cat-lebensmittel', 0.62]]));

    expect(predictCategory(bewertet, tx({ payee: 'Lidl 4711' }))?.sicher).toBe(false);
  });
});
