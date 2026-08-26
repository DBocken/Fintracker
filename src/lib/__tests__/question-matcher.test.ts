import { describe, it, expect } from 'vitest';
import { parseZeitraum } from '@/lib/question-time-expressions';
import { entscheideRouting, istSzenarioFrage, lexicalQuestionMatcher, routeFrage } from '@/lib/question-matcher';
import type { QuestionCandidate, QuestionVocabulary } from '@/lib/question-matcher';
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
/** Verlangt KEINE Slots — genau die Bauform, die alles überstrahlte. */
const einnahmen: QuestionEntry = {
  id: 'einnahmen.zeitraum',
  slots: { erforderlich: [], optional: ['zeitraum', 'kategorie'] },
  ausloeser: ['t.einnahmen'],
  needs: [],
  aufwand: 'guenstig',
  antwort: () => {
    throw new Error('nicht aufgerufen');
  },
};
const ausgabenKategorie: QuestionEntry = {
  id: 'ausgaben.kategorie',
  slots: { erforderlich: ['kategorie'], optional: ['zeitraum'] },
  ausloeser: ['t.ausgaben', 't.fuer'],
  needs: [],
  aufwand: 'guenstig',
  antwort: () => {
    throw new Error('nicht aufgerufen');
  },
};
const entries = [ausgabenHaendler, ausgabenKategorie, einnahmen, leistbarkeit];

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
    // Ohne die Präposition „für": Ein Funktionswort ist seit WP-F.2 nie ein
    // Auslöser. Händler gegen Kategorie unterscheidet der SLOT.
    ['ausgaben.kategorie', ['ausgegeben', 'ausgaben']],
    ['einnahmen.zeitraum', ['eingenommen', 'einnahmen', 'verdient']],
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

  it('sollte bei gleicher Relevanz den vollständigen Kandidaten vorziehen', () => {
    const kandidaten = match('ausgaben bei lidl, kann ich mir was leisten');

    expect(kandidaten[0].entryId).toBe('ausgaben.haendler');
    expect(kandidaten[0].fehlend).toEqual([]);
  });

  it('[REGRESSION] sollte eine Ausgabenfrage NICHT mit Einnahmen beantworten', () => {
    // Gemeldet aus der laufenden App: „wieviel habe ich letzten monat für
    // essen ausgegeben?" ergab „2.703,00 € — Einnahmen, Juli 2026".
    //
    // Zwei Defekte griffen ineinander. (1) `einnahmen.zeitraum` kam überhaupt
    // erst in die Auswahl, weil der Zeitausdruck allein Punkte gab — kein
    // einziges seiner Auslösewörter stand im Satz. (2) Die Sortierung stellte
    // Vollständigkeit über Relevanz, und ein Eintrag ohne Pflicht-Slots ist
    // per Definition immer vollständig — er überstrahlte damit jeden anderen.
    //
    // Seit dem Marge-Gate (WP-F.2) wird auf der ENTSCHEIDUNGS-Ebene geprüft:
    // Ohne auflösbare Kategorie sind Händler- und Kategorie-Deutung ehrlich
    // gleichauf — dann wird gewählt, nicht geraten. Einnahmen sind in keiner
    // Variante dabei.
    const kandidaten = match('wieviel habe ich letzten monat fuer essen ausgegeben?');
    expect(kandidaten.map((k) => k.entryId)).not.toContain('einnahmen.zeitraum');

    const routing = entscheideRouting(kandidaten);
    expect(routing.art).toBe('kandidaten');
    if (routing.art === 'kandidaten') {
      expect(routing.top.map((k) => k.entryId).sort()).toEqual([
        'ausgaben.haendler',
        'ausgaben.kategorie',
      ]);
    }
  });

  it('sollte mit auflösbarem abstraktem Begriff DIREKT antworten — benannt, nicht still', () => {
    // Die Zuordnung abstrakter Begriffe („für essen") ist die ausdrücklich
    // verlangte Kernfunktion dieser Fläche. Die Erschliessung wiegt deshalb
    // wie ein wörtlicher Treffer — die Marge zum Händler-Geschwister reicht,
    // und es wird geantwortet. Ihre Absicherung ist die BENENNUNG in
    // `erschlossen` (die Fläche zeigt „Verstanden als …", korrigierbar),
    // nicht ein Punktabschlag. Die Kipper, die das früher erzeugte, hingen
    // am Auslöser „kostet" und sind dort behoben (Kommentar im Matcher).
    const mitAufloesung: QuestionVocabulary = {
      ...vokabular,
      kategorieAusText: (text) =>
        text.includes('essen') ? { categoryId: 'cat-food', confidence: 0.8 } : null,
    };
    const kandidaten = lexicalQuestionMatcher.match(
      'wieviel habe ich letzten monat fuer essen ausgegeben?',
      mitAufloesung,
      entries,
      'de',
      JETZT,
    );

    const routing = entscheideRouting(kandidaten);
    expect(routing.art).toBe('aufloesen');
    if (routing.art === 'aufloesen') {
      expect(routing.kandidat.entryId).toBe('ausgaben.kategorie');
      expect(routing.kandidat.slots.kategorieIds).toEqual(['cat-food']);
      expect(routing.kandidat.erschlossen).toEqual(['kategorie']);
    }
  });

  it('sollte einen Eintrag ohne Auslöser-Treffer gar nicht vorschlagen', () => {
    // Ein Zeitraum allein ist kein Beleg dafür, wonach gefragt wurde.
    const kandidaten = match('letzten monat');

    expect(kandidaten).toEqual([]);
  });

  it('sollte ohne jedes Unterscheidungsmerkmal wählen lassen statt zu raten', () => {
    // „ausgegeben" trifft Händler- UND Kategorie-Eintrag, kein Slot trennt
    // sie — das ist echte Mehrdeutigkeit, und die Entscheidung darüber trifft
    // der Nutzer, nicht die Sortierreihenfolge.
    const routing = entscheideRouting(match('wieviel habe ich fuer essen ausgegeben?'));

    expect(routing.art).toBe('kandidaten');
  });

  it('sollte Einnahmen liefern, wenn danach GEFRAGT wird', () => {
    const kandidaten = match('wieviel habe ich letzten monat eingenommen?');

    expect(kandidaten[0].entryId).toBe('einnahmen.zeitraum');
    expect(kandidaten[0].fehlend).toEqual([]);
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

describe('Auslöser-Semantik (WP-F.2)', () => {
  const eintrag = (id: string): QuestionEntry => ({
    id,
    slots: { erforderlich: [], optional: ['zeitraum', 'haendler', 'kategorie', 'betrag'] },
    ausloeser: [`k.${id}`],
    needs: [],
    aufwand: 'guenstig',
    antwort: () => { throw new Error('nicht gefragt'); },
  });

  const vok = (ausloeser: Record<string, string[]>): QuestionVocabulary => ({
    kategorien: [],
    konten: [],
    haendler: [],
    ausloeser: new Map(Object.entries(ausloeser)),
  });

  it('[REGRESSION] sollte ein einzelnes Funktionswort NIE als Auslöser werten', () => {
    // Der gemessene 180/225-Fehler: „leisten kann ich mir" zerfiel in Token,
    // und „kann/ich/mir" machten den Eintrag zum Treffer für fast jede
    // umgangssprachliche Frage.
    const treffer = lexicalQuestionMatcher.match(
      'was kostet mich mein auto eig im monat alles zusammen',
      vok({ leistbarkeit: ['kann', 'ich', 'mir', 'leisten'] }),
      [eintrag('leistbarkeit')],
      'de',
      new Date('2026-08-23'),
    );
    expect(treffer).toHaveLength(0);
  });

  it('sollte eine Mehrwort-Phrase als Ganzes treffen', () => {
    // Das Beispiel hiess bis Welle 2 „kann ich mir" — und war damit selbst
    // ein Gegenbeispiel zur Regel, die es belegen sollte: eine Phrase aus
    // lauter Funktionswörtern. Sie trifft seither nicht mehr (Test darunter);
    // die Aussage dieses Tests — eine PHRASE wird als Ganzes gesucht, nicht
    // in Token zerlegt — braucht dafür bloss ein Beispiel mit Inhaltswort,
    // so wie es die echten Auslöser im Sprachbaum ohnehin haben.
    const treffer = lexicalQuestionMatcher.match(
      'kann ich mir das leisten?',
      vok({ leistbarkeit: ['mir das leisten'] }),
      [eintrag('leistbarkeit')],
      'de',
      new Date('2026-08-23'),
    );
    expect(treffer).toHaveLength(1);
  });

  it('[REGRESSION] sollte eine PHRASE aus lauter Funktionswörtern nie werten', () => {
    // Der Fund der Welle 2: Die Funktionswort-Regel galt nur für das
    // EINZELNE Wort. „noch für" stand deshalb als Auslöser von `budget.rest`
    // im Sprachbaum und fing „wie viel muss ich noch fürs finanzamt
    // zurücklegen" ab — eine Steuerfrage, beantwortet mit dem Restbudget.
    // Zwei Funktionswörter tragen so wenig Absicht wie eines.
    const treffer = lexicalQuestionMatcher.match(
      'wie viel muss ich noch fürs finanzamt zurücklegen',
      vok({ leistbarkeit: ['noch für'] }),
      [eintrag('leistbarkeit')],
      'de',
      new Date('2026-08-23'),
    );
    expect(treffer).toHaveLength(0);
  });

  it('[REGRESSION] sollte ein Einzelwort nur an Wortgrenzen treffen', () => {
    // „Sparrate" enthält „rate", meint aber keine Ratenzahlung — der
    // Substring-Treffer hat im Korpus falsche Antworten erzeugt.
    const treffer = lexicalQuestionMatcher.match(
      'Welche monatliche Sparrate brauche ich?',
      vok({ raten: ['rate'] }),
      [eintrag('raten')],
      'de',
      new Date('2026-08-23'),
    );
    expect(treffer).toHaveLength(0);
  });

  it('sollte deutsche Komposita über das Wortende treffen', () => {
    // „Freizeitbudget" fragt nach einem Budget — ab fünf Zeichen zählt das
    // Wortende, damit kurze Auslöser nicht zur Teilzeichenkette werden.
    const treffer = lexicalQuestionMatcher.match(
      'Wie viel ist noch in meinem Freizeitbudget übrig?',
      vok({ budget: ['budget'] }),
      [eintrag('budget')],
      'de',
      new Date('2026-08-23'),
    );
    expect(treffer).toHaveLength(1);
  });
});

describe('entscheideRouting (Marge-Gate)', () => {
  const kandidat = (entryId: string, score: number): QuestionCandidate => ({
    entryId,
    score,
    slots: {},
    fehlend: [],
    erschlossen: [],
  });

  it('sollte ohne Kandidaten „unverstanden" melden', () => {
    expect(entscheideRouting([]).art).toBe('unverstanden');
  });

  it('sollte bei klarem Abstand auflösen', () => {
    const r = entscheideRouting([kandidat('a', 5), kandidat('b', 3)]);
    expect(r.art).toBe('aufloesen');
  });

  it('[REGRESSION] sollte bei knappem Abstand WÄHLEN lassen statt zu raten', () => {
    // Zwei Deutungen, ein Punkt Abstand: Aus Sicht des Routers ist die Frage
    // mehrdeutig, und Mehrdeutigkeit ist ein Ergebnis (AGENTS.md §3).
    const r = entscheideRouting([kandidat('a', 4), kandidat('b', 3), kandidat('c', 3)]);
    expect(r.art).toBe('kandidaten');
    if (r.art === 'kandidaten') {
      expect(r.top.map((k) => k.entryId)).toEqual(['a', 'b', 'c']);
    }
  });

  it('sollte bei Gleichstand höchstens drei Kandidaten anbieten', () => {
    const r = entscheideRouting([kandidat('a', 3), kandidat('b', 3), kandidat('c', 3), kandidat('d', 3)]);
    expect(r.art).toBe('kandidaten');
    if (r.art === 'kandidaten') expect(r.top).toHaveLength(3);
  });
});

describe('Verstärker (WP-F.3)', () => {
  const eintrag = (id: string, verstaerker: string[] = []): QuestionEntry => ({
    id,
    slots: { erforderlich: [], optional: [] },
    ausloeser: [`k.${id}`],
    verstaerker: verstaerker.length ? [`v.${id}`] : undefined,
    needs: [],
    aufwand: 'guenstig',
    antwort: () => { throw new Error('nicht gefragt'); },
  });

  it('[REGRESSION] sollte ein Verstärker-Wort allein NIE qualifizieren', () => {
    // Gemessen: Als normaler Auslöser hat „alles zusammen" die Abo-Summe auf
    // „was kostet mich mein auto … alles zusammen" antworten lassen.
    const kandidaten = lexicalQuestionMatcher.match(
      'was kostet mich mein auto alles zusammen',
      {
        kategorien: [], konten: [], haendler: [],
        ausloeser: new Map([['abos.summe', ['abo']]]),
        verstaerker: new Map([['abos.summe', ['alles zusammen']]]),
      },
      [eintrag('abos.summe', ['x'])],
      'de',
      new Date('2026-08-23'),
    );
    expect(kandidaten).toHaveLength(0);
  });

  it('sollte einen Verstärker NACH einem Auslöser-Treffer mitzählen', () => {
    const vok: QuestionVocabulary = {
      kategorien: [], konten: [], haendler: [],
      ausloeser: new Map([['abos.summe', ['abos']], ['abos.liste', ['abos']]]),
      verstaerker: new Map([['abos.summe', ['zusammen']]]),
    };
    const kandidaten = lexicalQuestionMatcher.match(
      'wieviel kosten mich alle abos zusammen?',
      vok,
      [eintrag('abos.summe', ['x']), eintrag('abos.liste')],
      'de',
      new Date('2026-08-23'),
    );
    expect(kandidaten[0].entryId).toBe('abos.summe');
    expect(kandidaten[0].score - kandidaten[1].score).toBeGreaterThanOrEqual(2);
  });
});

describe('Szenario-Gate (WP-F.3)', () => {
  const bestand: QuestionEntry = {
    id: 'budget.status',
    slots: { erforderlich: [], optional: [] },
    ausloeser: ['k.budget'],
    needs: [],
    aufwand: 'guenstig',
    antwort: () => { throw new Error('nicht gefragt'); },
  };
  const simulation: QuestionEntry = { ...bestand, id: 'leistbarkeit.anschaffung', beantwortetSzenarien: true };
  const vok: QuestionVocabulary = {
    kategorien: [], konten: [], haendler: [],
    ausloeser: new Map([
      ['budget.status', ['budget']],
      ['leistbarkeit.anschaffung', ['leisten']],
    ]),
  };

  it('[REGRESSION] sollte eine hypothetische Frage keiner Bestandsauswertung geben', () => {
    // „Wenn ich mein Shoppingbudget um 30 Prozent reduziere …" redet über
    // eine VERÄNDERTE Welt; der Budget-Stand von heute beantwortet sie nicht.
    const kandidaten = lexicalQuestionMatcher.match(
      'wenn ich mein shoppingbudget um 30 prozent reduziere, wie viel spare ich?',
      vok,
      [bestand],
      'de',
      new Date('2026-08-23'),
    );
    expect(kandidaten).toHaveLength(0);
  });

  it('sollte die Simulation hypothetische Fragen weiterhin nehmen lassen', () => {
    const kandidaten = lexicalQuestionMatcher.match(
      'kann ich mir das leisten, wenn ich monatlich 200 spare?',
      vok,
      [bestand, simulation],
      'de',
      new Date('2026-08-23'),
    );
    expect(kandidaten.map((k) => k.entryId)).toEqual(['leistbarkeit.anschaffung']);
  });

  it('sollte „wenn alle …" NICHT als Szenario werten — das beschreibt den Ist-Plan', () => {
    expect(istSzenarioFrage('wie viel bleibt, wenn alle abbuchungen stattfinden?')).toBe(false);
    expect(istSzenarioFrage('was passiert, wenn ich 100 weniger ausgebe?')).toBe(true);
  });
});

describe('Gelernte Formulierung im Allein-Fall (WP-F.5, Browser-Fund)', () => {
  it('sollte eine sehr sichere Stufe-2-Deutung ohne Auslösewort DIREKT auflösen', () => {
    // Ohne diesen Pfad blieb ein Satz ohne Auslösewort auch nach dem Lernen
    // für immer „nur Vermutung" — die Lernschleife war für genau die
    // Formulierungen wirkungslos, für die es sie gibt.
    const entry: QuestionEntry = {
      id: 'ausgaben.haendler',
      slots: { erforderlich: [], optional: [] },
      ausloeser: ['k.x'],
      needs: [],
      aufwand: 'guenstig',
      antwort: () => { throw new Error('nicht gefragt'); },
    };
    const vok: QuestionVocabulary = {
      kategorien: [], konten: [], haendler: [],
      ausloeser: new Map([['ausgaben.haendler', ['zzzz']]]),
    };

    const gelernt = routeFrage('völlig eigene formulierung', vok, [entry], 'de', new Date('2026-08-23'), {
      klasse: 'ausgaben.haendler',
      marge: 0.5,
    });
    expect(gelernt.art).toBe('aufloesen');

    const vermutet = routeFrage('völlig eigene formulierung', vok, [entry], 'de', new Date('2026-08-23'), {
      klasse: 'ausgaben.haendler',
      marge: 0.1,
    });
    expect(vermutet.art).toBe('kandidaten');
    if (vermutet.art === 'kandidaten') expect(vermutet.nurVermutung).toBe(true);
  });
});

describe('Szenario-Gate an BEIDEN Router-Stufen', () => {
  /**
   * Der Fund der Welle 2: `match()` (Wortebene) wendete das Szenario-Gate an,
   * Stufe 2 (Klassifikator) nicht. Damit konnte das Modell für eine
   * HYPOTHETISCHE Frage einen Eintrag vorschlagen, den die Wortebene
   * ausdrücklich ausgeschlossen hatte — gemessen am Korpus bekam „was wen ich
   * freizeit um 200 reduzier …" den Eintrag `budget.aktion` angeboten, also
   * eine SCHREIBOPERATION als Antwort auf ein Gedankenspiel.
   *
   * Das wiegt schwerer als eine falsche Zahl: Die falsche Zahl verwirrt, der
   * falsch gedeutete Befehl schlägt eine Änderung an den Daten vor.
   */
  const nichtSzenariofaehig: QuestionEntry = {
    id: 'budget.aktion',
    slots: { erforderlich: [], optional: [] },
    ausloeser: ['k.nie'],
    needs: [],
    aufwand: 'guenstig',
    antwort: () => { throw new Error('nicht gefragt'); },
  };
  const szenariofaehig: QuestionEntry = {
    ...nichtSzenariofaehig,
    id: 'leistbarkeit.anschaffung',
    beantwortetSzenarien: true,
  };
  const vok: QuestionVocabulary = {
    kategorien: [], konten: [], haendler: [],
    // Bewusst LEER: Die Wortebene findet nichts, damit allein Stufe 2 entscheidet.
    ausloeser: new Map(),
  };
  const JETZT = new Date('2026-08-23');

  it('[REGRESSION] sollte einem nicht-szenariofähigen Eintrag die hypothetische Frage verweigern', () => {
    const routing = routeFrage('was wenn ich freizeit um 200 reduziere', vok, [nichtSzenariofaehig], 'de', JETZT, {
      klasse: 'budget.aktion',
      marge: 0.9,
    });
    expect(routing.art).toBe('unverstanden');
  });

  it('sollte den szenariofähigen Eintrag weiterhin durchlassen', () => {
    const routing = routeFrage('was wenn ich freizeit um 200 reduziere', vok, [szenariofaehig], 'de', JETZT, {
      klasse: 'leistbarkeit.anschaffung',
      marge: 0.9,
    });
    expect(routing.art).toBe('aufloesen');
  });

  it('sollte denselben Eintrag ohne Hypothese normal vorschlagen', () => {
    // Gegenprobe: Das Gate darf nur bei einer HYPOTHETISCHEN Frage greifen —
    // sonst wäre es keine Schranke, sondern eine Abschaltung.
    const routing = routeFrage('erhöhe mein freizeitbudget um 200', vok, [nichtSzenariofaehig], 'de', JETZT, {
      klasse: 'budget.aktion',
      marge: 0.9,
    });
    expect(routing.art).toBe('aufloesen');
  });
});
