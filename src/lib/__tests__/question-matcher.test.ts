import { describe, it, expect } from 'vitest';
import { parseZeitraum } from '@/lib/question-time-expressions';
import { lexicalQuestionMatcher } from '@/lib/question-matcher';
import type { QuestionVocabulary } from '@/lib/question-matcher';
import type { QuestionEntry } from '@/lib/question-registry';

const JETZT = new Date('2026-07-20T12:00:00Z');

describe('parseZeitraum', () => {
  it('sollte „letzten Monat" auflösen', () => {
    expect(parseZeitraum('wieviel letzten monat', 'de', JETZT)?.slot.rangeToken).toBe('2026-06');
  });

  it('sollte „diesen Monat" auflösen', () => {
    expect(parseZeitraum('diesen monat', 'de', JETZT)?.slot.rangeToken).toBe('2026-07');
  });

  it('sollte „letztes Jahr" auflösen', () => {
    expect(parseZeitraum('letztes jahr', 'de', JETZT)?.slot.rangeToken).toBe('2025');
  });

  it('sollte einen Monatsnamen mit Jahr auflösen', () => {
    expect(parseZeitraum('im juli 2025', 'de', JETZT)?.slot.rangeToken).toBe('2025-07');
  });

  it('sollte einen Monatsnamen ohne Jahr auf den zuletzt VERGANGENEN legen', () => {
    // „Im Oktober" ist im Juli der Oktober des VORjahres — nach einem, der
    // noch bevorsteht, gäbe es nichts zu berichten.
    expect(parseZeitraum('im oktober', 'de', JETZT)?.slot.rangeToken).toBe('2025-10');
    expect(parseZeitraum('im maerz', 'de', JETZT)?.slot.rangeToken).toBe('2026-03');
  });

  it('sollte Quartale in beiden Schreibweisen auflösen', () => {
    expect(parseZeitraum('q2 2026', 'de', JETZT)?.slot.rangeToken).toBe('2026-Q2');
    expect(parseZeitraum('2026-q3', 'de', JETZT)?.slot.rangeToken).toBe('2026-Q3');
  });

  it('sollte Tagesspannen auflösen', () => {
    expect(parseZeitraum('letzten 30 tage', 'de', JETZT)?.slot.rangeToken).toBe('30d');
  });

  it('sollte englische Ausdrücke auflösen', () => {
    expect(parseZeitraum('last month', 'en', JETZT)?.slot.rangeToken).toBe('2026-06');
    expect(parseZeitraum('in july 2025', 'en', JETZT)?.slot.rangeToken).toBe('2025-07');
  });

  it('sollte einen Zeitraum mit gültigem Start und Ende liefern', () => {
    const treffer = parseZeitraum('im juli 2025', 'de', JETZT);
    expect(treffer?.slot.von).toBe('2025-07-01');
    expect(treffer?.slot.bis).toBe('2025-07-31');
  });

  it('sollte für eine Sprache ohne Ausdrücke NICHTS raten', () => {
    // Benannte Grenze: Russisch hat keine Tabelle. Die Fläche fragt dann nach,
    // statt einen Zeitraum zu erfinden.
    expect(parseZeitraum('в прошлом месяце', 'ru', JETZT)).toBeNull();
  });

  it('sollte ohne Zeitausdruck null liefern', () => {
    expect(parseZeitraum('wieviel bei lidl', 'de', JETZT)).toBeNull();
  });
});

/** Zwei Einträge, die sich nur in ihren Slots unterscheiden. */
const ausgabenHaendler: QuestionEntry = {
  id: 'ausgaben.haendler',
  slots: { erforderlich: ['haendler'], optional: ['zeitraum', 'konto'] },
  ausloeser: ['t.ausgaben'],
  needs: [],
  aufwand: 'guenstig',
  antwort: () => {
    throw new Error('nicht aufgerufen');
  },
};
const leistbarkeit: QuestionEntry = {
  id: 'leistbarkeit.anschaffung',
  slots: { erforderlich: ['betrag'], optional: [] },
  ausloeser: ['t.leisten'],
  needs: [],
  aufwand: 'teuer',
  antwort: () => {
    throw new Error('nicht aufgerufen');
  },
};
const entries = [ausgabenHaendler, leistbarkeit];

const vokabular: QuestionVocabulary = {
  kategorien: [
    { wort: 'lebensmittel', wert: 'local-cat-lebensmittel' },
    { wort: 'freizeit', wert: 'local-cat-freizeit' },
  ],
  konten: [{ wort: 'girokonto', wert: 'acc-giro' }],
  haendler: [
    { wort: 'lidl', wert: 'lidl' },
    { wort: 'lidl sagt danke', wert: 'lidl sagt danke' },
  ],
  ausloeser: new Map([
    ['ausgaben.haendler', ['ausgegeben', 'ausgaben']],
    ['leistbarkeit.anschaffung', ['leisten']],
  ]),
};

function match(text: string) {
  return lexicalQuestionMatcher.match(text, vokabular, entries, 'de', JETZT);
}

describe('lexicalQuestionMatcher', () => {
  it('sollte Händler und Zeitraum aus einer ganzen Frage füllen', () => {
    const [beste] = match('Wieviel habe ich im Juli 2025 bei Lidl ausgegeben?');

    expect(beste.entryId).toBe('ausgaben.haendler');
    // Getippt wurde „Lidl", also ist „lidl" der Slot — nicht die laengere
    // Vokabel „lidl sagt danke", die im Text gar nicht vorkommt. Der
    // Haendlerfilter matcht danach als Teilzeichenkette (`matchesMerchantFilter`).
    expect(beste.slots.haendler).toBe('lidl');
    expect(beste.slots.zeitraum?.rangeToken).toBe('2025-07');
    expect(beste.fehlend).toEqual([]);
  });

  it('sollte den LÄNGSTEN Händlertreffer nehmen', () => {
    // „lidl" und „lidl sagt danke" treffen beide — der spezifischere gewinnt,
    // dieselbe Regel wie bei den Händlerregeln in `categorization.ts`.
    expect(match('ausgaben bei lidl sagt danke')[0].slots.haendler).toBe('lidl sagt danke');
  });

  it('sollte fehlende Pflicht-Slots melden statt zu raten', () => {
    const [beste] = match('Wieviel habe ich ausgegeben?');

    expect(beste.entryId).toBe('ausgaben.haendler');
    expect(beste.fehlend).toEqual(['haendler']);
    expect(beste.slots.haendler).toBeUndefined();
  });

  it('sollte einen Betrag als Slot erkennen', () => {
    const kandidat = match('Kann ich mir 12.000 € leisten?').find(
      (k) => k.entryId === 'leistbarkeit.anschaffung',
    );

    expect(kandidat?.slots.betrag).toBe(12000);
    expect(kandidat?.fehlend).toEqual([]);
  });

  it('sollte einen deutschen Dezimalbetrag richtig lesen', () => {
    const kandidat = match('Kann ich mir 1.250,50 leisten?').find(
      (k) => k.entryId === 'leistbarkeit.anschaffung',
    );

    // Der Tausenderpunkt darf nicht als Dezimaltrenner gelesen werden —
    // sonst wäre die Frage 1000-mal zu klein (AGENTS.md §8).
    expect(kandidat?.slots.betrag).toBe(1250.5);
  });

  it('sollte bei mehrdeutigem Vokabular NICHT raten', () => {
    const mehrdeutig: QuestionVocabulary = {
      ...vokabular,
      haendler: [
        // Gleich lang, verschiedene Haendler — und bewusst KEIN Monatsname,
        // der sonst schon vom Zeitausdruck verbraucht wuerde.
        { wort: 'zoo', wert: 'zoo handel' },
        { wort: 'bau', wert: 'bau gmbh' },
      ],
    };

    const [beste] = lexicalQuestionMatcher.match(
      'ausgaben bei zoo bau',
      mehrdeutig,
      entries,
      'de',
      JETZT,
    );

    // Zwei gleich lange Treffer ⇒ Slot bleibt offen, die Fläche fragt nach.
    expect(beste.slots.haendler).toBeUndefined();
    expect(beste.fehlend).toEqual(['haendler']);
  });

  it('sollte einen Monatsnamen nicht als Händler verbrauchen', () => {
    const mitMai: QuestionVocabulary = {
      ...vokabular,
      haendler: [{ wort: 'mai', wert: 'mai handel' }],
    };

    const [beste] = lexicalQuestionMatcher.match('ausgaben im mai', mitMai, entries, 'de', JETZT);

    // „Mai" ist hier der Monat: Der Zeitausdruck wird ZUERST aus dem Text
    // geschnitten, sonst fände der Händler sich im Zeitraum wieder.
    expect(beste.slots.zeitraum?.rangeToken).toBe('2026-05');
    expect(beste.slots.haendler).toBeUndefined();
  });

  it('sollte vollständige Kandidaten vor unvollständige sortieren', () => {
    const kandidaten = match('ausgaben bei lidl, kann ich mir was leisten');

    expect(kandidaten[0].fehlend).toEqual([]);
    expect(kandidaten[0].entryId).toBe('ausgaben.haendler');
  });

  it('sollte reproduzierbar sein', () => {
    expect(match('ausgaben bei lidl im juli 2025')).toEqual(
      match('ausgaben bei lidl im juli 2025'),
    );
  });

  it('sollte bei leerer Eingabe nichts vorschlagen', () => {
    expect(match('   ')).toEqual([]);
  });
});
