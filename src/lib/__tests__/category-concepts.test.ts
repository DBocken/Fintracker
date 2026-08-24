import { describe, expect, it } from 'vitest';
import { findeKonzeptKategorien, konzepteFuer } from '../category-concepts';
import type { Category } from '@/types';

/**
 * Der Befund hinter dieser Datei: „Essen" spannt über HAUPTKATEGORIEN hinweg
 * („Lebensmittel" und „Essen & Trinken" sind in der Standard-Taxonomie
 * getrennt), „Auto" sogar über Mobilität, Versicherungen und Finanzen. Die
 * Eltern-Kette löst das nicht — deshalb eine Gruppe statt einer Kategorie.
 */

function kat(id: string, name: string, filters: string[] = []): Category {
  return { id, name, filters, user_id: 'local' } as Category;
}

/** Ausschnitt der echten Taxonomie — inklusive der Trennung, um die es geht. */
const BESTAND: Category[] = [
  kat('c-lebensmittel', 'Lebensmittel'),
  kat('c-supermarkt', 'Supermarkt', ['rewe', 'aldi', 'edeka']),
  kat('c-wochenmarkt', 'Wochenmarkt', ['marktstand']),
  kat('c-baeckerei', 'Bäckerei', ['backwerk']),
  kat('c-essen', 'Essen & Trinken'),
  kat('c-restaurant', 'Restaurant', ['pizzeria', 'gasthaus']),
  kat('c-mobilitaet', 'Mobilität'),
  kat('c-tanken', 'Tanken', ['aral', 'shell', 'kraftstoff']),
  kat('c-werkstatt', 'Werkstatt & TÜV', ['autohaus', 'autoteile']),
  kat('c-kfzversicherung', 'Kfz-Versicherung', ['autoversicherung']),
  kat('c-bargeld', 'Bargeld', ['geldautomat']),
  kat('c-kleidung', 'Kleidung', ['zalando']),
];

describe('findeKonzeptKategorien', () => {
  it('sollte „essen" über BEIDE Hauptkategorien hinweg auflösen', () => {
    const treffer = findeKonzeptKategorien('wieviel gebe ich für essen aus', BESTAND, 'de');

    expect(treffer?.konzept).toBe('essen');
    expect(treffer?.categoryIds).toEqual(
      expect.arrayContaining([
        'c-lebensmittel',
        'c-supermarkt',
        'c-wochenmarkt',
        'c-baeckerei',
        'c-essen',
        'c-restaurant',
      ]),
    );
    // Und nichts Fremdes.
    expect(treffer?.categoryIds).not.toContain('c-kleidung');
  });

  it('sollte „auto" über Mobilität, Werkstatt und Versicherung hinweg auflösen', () => {
    const treffer = findeKonzeptKategorien('was kostet mich auto', BESTAND, 'de');

    expect(treffer?.categoryIds).toEqual(
      expect.arrayContaining(['c-tanken', 'c-werkstatt', 'c-kfzversicherung', 'c-mobilitaet']),
    );
  });

  it('[REGRESSION] sollte „auto" NICHT auf „Geldautomat" ziehen', () => {
    // Der Grund für die Wortanfang-Regel: Als Teilzeichenkette steckt „auto"
    // in „geldautomat", und die Bargeld-Kategorie in einer Autofrage wäre
    // grob falsch — sie verfälschte die Summe still.
    const treffer = findeKonzeptKategorien('was kostet mich auto', BESTAND, 'de');

    expect(treffer?.categoryIds).not.toContain('c-bargeld');
  });

  it('sollte Stichwörter mitlesen, nicht nur Kategorienamen', () => {
    // „Tanken" enthält kein „auto" — der Treffer kommt über das Stichwort
    // „kraftstoff". Genau deshalb nennt die Tabelle Suchbegriffe und keine
    // Kategorie-IDs.
    const treffer = findeKonzeptKategorien('auto kosten', BESTAND, 'de');
    expect(treffer?.categoryIds).toContain('c-tanken');
  });

  it('sollte eine selbst angelegte Kategorie mitnehmen', () => {
    // Der Grund für Begriffe statt IDs: Eine ID-Liste kennt nur den Bestand
    // von gestern.
    const eigen = [...BESTAND, kat('local-cat-bio', 'Bio-Supermarkt')];
    const treffer = findeKonzeptKategorien('essen', eigen, 'de');

    expect(treffer?.categoryIds).toContain('local-cat-bio');
  });

  it('sollte ohne Oberbegriff nichts behaupten', () => {
    expect(findeKonzeptKategorien('wieviel habe ich bei lidl ausgegeben', BESTAND, 'de')).toBeNull();
  });

  it('sollte ein Konzept mit weniger als zwei Treffern verwerfen', () => {
    // Eine einzelne Kategorie ist keine Gruppe — dafür ist die
    // Einzelauflösung genauer (sie kennt Händlerregeln und das gelernte
    // Modell).
    expect(findeKonzeptKategorien('essen', [kat('c-restaurant', 'Restaurant')], 'de')).toBeNull();
  });

  it('sollte den Oberbegriff nur als WORT erkennen', () => {
    // „interessen" enthält „essen", fragt aber nicht danach.
    expect(findeKonzeptKategorien('meine interessen', BESTAND, 'de')).toBeNull();
  });

  it('sollte deutsche Komposita des Oberbegriffs erkennen', () => {
    expect(findeKonzeptKategorien('meine essensausgaben', BESTAND, 'de')?.konzept).toBe('essen');
  });

  it('sollte für eine unbekannte Sprache auf Deutsch zurückfallen statt zu schweigen', () => {
    expect(findeKonzeptKategorien('essen', BESTAND, 'tlh')?.konzept).toBe('essen');
  });
});

describe('Kurations-Regeln der Begriffstabelle', () => {
  it('sollte je Sprache nur Oberbegriffe ab drei Zeichen führen', () => {
    // Kürzere Schlüssel würden nie erkannt (Mindestlänge im Matcher) — ein
    // stummer Eintrag ist schlimmer als keiner. Drei Zeichen sind erlaubt,
    // treffen aber nur EXAKT: Englisch bildet keine Komposita, ein am
    // Wortanfang greifendes „car" fände „cards" und „career".
    for (const locale of ['de', 'en', 'ru']) {
      for (const konzept of Object.keys(konzepteFuer(locale))) {
        expect(konzept.length, `${locale}: ${konzept}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('[REGRESSION] sollte einen kurzen Oberbegriff NICHT am Wortanfang greifen lassen', () => {
    // Gemessen beim Einführen: „car" als Präfix zieht „cards", „care",
    // „career" herein. Kurze Begriffe können sich Präfix-Treffer nicht
    // leisten — deutsche Komposita brauchen sie, englische nicht.
    const bestand = [
      kat('c-car', 'Car'),
      kat('c-fuel', 'Fuel', ['petrol']),
      kat('c-cards', 'Cards & Gifts', ['career coaching']),
    ];
    const treffer = findeKonzeptKategorien('what does car cost me', bestand, 'en');

    expect(treffer?.categoryIds).toEqual(expect.arrayContaining(['c-car', 'c-fuel']));
    expect(treffer?.categoryIds).not.toContain('c-cards');
  });

  it('sollte je Oberbegriff mindestens zwei Suchbegriffe führen', () => {
    for (const locale of ['de', 'en', 'ru']) {
      for (const [konzept, begriffe] of Object.entries(konzepteFuer(locale))) {
        expect(begriffe.length, `${locale}: ${konzept}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
