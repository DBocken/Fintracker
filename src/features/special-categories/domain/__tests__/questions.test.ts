import { describe, expect, it } from 'vitest';
import { questionCatalog } from '@/features/money-questions/data/question-catalog';
import { asTransactionId } from '@/lib/ids';
import type { QuestionData } from '@/features/shared/domain/question-registry';
import type { SpecialCategory, SpecialCategoryAssignment, Transaction } from '@/types';

/**
 * Anlass-Einträge (Welle 2).
 *
 * Anlässe schneiden QUER durch die Kategorien — dieselbe Buchung liegt in
 * „Restaurants" und gehört zum Urlaub. Geprüft wird deshalb vor allem, dass
 * die Zuordnungs-Achse nicht mit der Kategorie-Achse verwechselt wird, und
 * dass ein Elternanlass seine Kind-Anlässe MITZÄHLT.
 */

const JETZT = new Date('2026-08-20T12:00:00Z');

const URLAUB: SpecialCategory = {
  id: 'ev-urlaub',
  name: 'Urlaub Italien',
  start_date: '2026-07-01',
  end_date: '2026-07-20',
} as SpecialCategory;

const HOCHZEIT: SpecialCategory = { id: 'ev-hochzeit', name: 'Hochzeit' } as SpecialCategory;
const FLITTER: SpecialCategory = {
  id: 'ev-flitter',
  name: 'Flitterwochen',
  parent_id: 'ev-hochzeit',
} as SpecialCategory;

let lfd = 0;
function tx(betrag: number, datum = '2026-07-05', id?: string): Transaction {
  lfd += 1;
  return {
    id: asTransactionId(id ?? `sc-${lfd}`),
    date: datum,
    amount: betrag,
    payee: 'Hotel Bella',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
  } as Transaction;
}

function zuordnung(anlass: string, transaktion: string): SpecialCategoryAssignment {
  return { id: `a-${anlass}-${transaktion}`, special_category_id: anlass, transaction_id: transaktion } as SpecialCategoryAssignment;
}

function daten(zusatz: Partial<QuestionData> = {}): QuestionData {
  return { specialCategories: [], specialCategoryAssignments: [], transactions: [], jetzt: JETZT, ...zusatz };
}

describe('anlass.kosten', () => {
  const eintrag = questionCatalog.byId('anlass.kosten')!;

  it('sollte die zugeordneten Kosten eines Anlasses nennen', () => {
    const antwort = eintrag.antwort(
      { anlassId: 'ev-urlaub' },
      daten({
        specialCategories: [URLAUB],
        transactions: [tx(-300, '2026-07-05', 't1'), tx(-200, '2026-07-08', 't2')],
        specialCategoryAssignments: [zuordnung('ev-urlaub', 't1'), zuordnung('ev-urlaub', 't2')],
      }),
    );
    expect(antwort.wert).toBe(500);
    expect(antwort.anzahl).toBe(2);
  });

  it('sollte eine Erstattung die Kosten MINDERN lassen, nicht erhöhen', () => {
    // Eine Gutschrift auf einen Anlass ist Geld zurück — sie als weitere
    // Ausgabe zu zählen verdoppelte den Fehler statt ihn auszugleichen.
    const antwort = eintrag.antwort(
      { anlassId: 'ev-urlaub' },
      daten({
        specialCategories: [URLAUB],
        transactions: [tx(-300, '2026-07-05', 't1'), tx(50, '2026-07-09', 't2')],
        specialCategoryAssignments: [zuordnung('ev-urlaub', 't1'), zuordnung('ev-urlaub', 't2')],
      }),
    );
    expect(antwort.wert).toBe(250);
  });

  it('[REGRESSION] sollte Kind-Anlässe MITZÄHLEN und den direkten Anteil belegen', () => {
    // Wer nach den Kosten der Hochzeit fragt, meint die Flitterwochen mit.
    // Ein Elternanlass, der sie unterschlägt, nennt eine Zahl, die niemand
    // nachrechnen kann.
    const antwort = eintrag.antwort(
      { anlassId: 'ev-hochzeit' },
      daten({
        specialCategories: [HOCHZEIT, FLITTER],
        transactions: [tx(-1000, '2026-06-01', 't1'), tx(-400, '2026-07-01', 't2')],
        specialCategoryAssignments: [zuordnung('ev-hochzeit', 't1'), zuordnung('ev-flitter', 't2')],
      }),
    );
    expect(antwort.wert).toBe(1400);
    expect(antwort.begruendung?.[0]?.params.direkt).toBe(1000);
  });

  it('sollte einen unbekannten Anlass benennen statt 0 € zu behaupten', () => {
    expect(eintrag.antwort({ anlassId: 'gibtsnicht' }, daten({ specialCategories: [URLAUB] })).art).toBe('keine');
  });
});

describe('anlass.liste', () => {
  const eintrag = questionCatalog.byId('anlass.liste')!;

  it('[REGRESSION] sollte einen Kind-Anlass NICHT zusätzlich listen', () => {
    // Er steckt bereits in der Teilbaum-Summe seines Elternteils; beide zu
    // listen zählte dieselben Euro zweimal.
    const antwort = eintrag.antwort(
      {},
      daten({
        specialCategories: [HOCHZEIT, FLITTER],
        transactions: [tx(-1000, '2026-06-01', 't1'), tx(-400, '2026-07-01', 't2')],
        specialCategoryAssignments: [zuordnung('ev-hochzeit', 't1'), zuordnung('ev-flitter', 't2')],
      }),
    );
    expect(antwort.posten?.map((p) => p.label)).toEqual(['Hochzeit']);
    expect(antwort.wert).toBe(1400);
  });

  it('sollte ohne Anlass „keiner angelegt" sagen', () => {
    expect(eintrag.antwort({}, daten()).art).toBe('keine');
  });
});

describe('anlass.vorschlag', () => {
  const eintrag = questionCatalog.byId('anlass.vorschlag')!;

  it('sollte Buchungen im Ereignisfenster vorschlagen — und dazusagen, dass nichts zugeordnet wird', () => {
    const antwort = eintrag.antwort(
      { anlassId: 'ev-urlaub' },
      daten({
        specialCategories: [URLAUB],
        transactions: [tx(-120, '2026-07-05', 't1'), tx(-90, '2026-07-10', 't2')],
      }),
    );
    expect(antwort.art).toBe('liste');
    expect(antwort.anzahl).toBe(2);
    expect(antwort.begruendung?.[0]?.key).toBe(
      'financeQuestions.reason.anlassVorschlagNichtZugeordnet',
    );
    // Ausdrücklich KEIN Quellen-Link: Die Liste ist ein Vorschlag, keine
    // Menge, aus der eine Zahl entstand.
    expect(antwort.deepLinkArt).toBe('kontext');
  });

  it('sollte bereits zugeordnete Buchungen nicht noch einmal vorschlagen', () => {
    const antwort = eintrag.antwort(
      { anlassId: 'ev-urlaub' },
      daten({
        specialCategories: [URLAUB],
        transactions: [tx(-120, '2026-07-05', 't1')],
        specialCategoryAssignments: [zuordnung('ev-urlaub', 't1')],
      }),
    );
    expect(antwort.art).toBe('keine');
  });

  it('sollte ohne Startdatum ABSAGEN statt ein Fenster zu erfinden', () => {
    const antwort = eintrag.antwort(
      { anlassId: 'ev-hochzeit' },
      daten({ specialCategories: [HOCHZEIT], transactions: [tx(-120, '2026-07-05', 't1')] }),
    );
    expect(antwort.aussage.key).toBe('financeQuestions.answer.anlassOhneZeitraum');
  });
});

describe('anlass.aktion', () => {
  const eintrag = questionCatalog.byId('anlass.aktion')!;

  it('sollte das Anlegen als Vorschau liefern', () => {
    const antwort = eintrag.antwort(
      { anlassAktion: { art: 'anlegen', anlassText: 'urlaub italien' } },
      daten(),
    );
    expect(antwort.art).toBe('aktion');
    expect(antwort.aktion?.art).toBe('anlassAnlegen');
  });

  it('[REGRESSION] sollte einen NAMENSGLEICHEN Anlass nicht ein zweites Mal anlegen', () => {
    // Zwei Anlässe mit demselben Namen machten jede spätere Zuordnung
    // mehrdeutig — und die Mehrdeutigkeit fiele erst auf, wenn schon Buchungen
    // an beiden hängen.
    const antwort = eintrag.antwort(
      { anlassAktion: { art: 'anlegen', anlassText: 'urlaub italien' } },
      daten({ specialCategories: [URLAUB] }),
    );
    expect(antwort.art).toBe('keine');
    expect(antwort.aussage.key).toBe('financeQuestions.answer.anlassAktionSchonDa');
  });

  it('sollte die VORSCHLÄGE zuordnen — dieselbe Menge wie der Lese-Eintrag', () => {
    // Zwei Wege zur selben Vorschlagsmenge wären zwei Orte, an denen sie
    // auseinanderlaufen kann; beide rufen `suggestTransactionsForEvent`.
    const zustand = daten({
      specialCategories: [URLAUB],
      transactions: [tx(-120, '2026-07-05', 't1'), tx(-90, '2026-07-10', 't2')],
    });
    const vorschau = eintrag.antwort(
      { anlassId: 'ev-urlaub', anlassAktion: { art: 'zuordnen', anlassText: 'urlaub' } },
      zustand,
    );
    const lesen = questionCatalog.byId('anlass.vorschlag')!.antwort({ anlassId: 'ev-urlaub' }, zustand);
    expect(vorschau.anzahl).toBe(lesen.anzahl);
    expect(vorschau.aktion?.art).toBe('anlassZuordnen');
  });

  it('sollte ohne Startdatum ABSAGEN statt ein Fenster zu erfinden', () => {
    const antwort = eintrag.antwort(
      { anlassId: 'ev-hochzeit', anlassAktion: { art: 'zuordnen', anlassText: 'hochzeit' } },
      daten({ specialCategories: [HOCHZEIT], transactions: [tx(-120, '2026-07-05', 't1')] }),
    );
    expect(antwort.aussage.key).toBe('financeQuestions.answer.anlassOhneZeitraum');
  });

  it('sollte ohne Namen nach ihm fragen statt einen zu erfinden', () => {
    const antwort = eintrag.antwort({ anlassAktion: { art: 'anlegen' } }, daten());
    expect(antwort.aussage.key).toBe('financeQuestions.answer.anlassAktionOhneName');
  });
});
