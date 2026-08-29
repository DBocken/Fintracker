import { describe, expect, it } from 'vitest';
import { routeFrage, zerlegeAusloeser, type QuestionVocabulary } from '@/features/money-questions/domain/question-matcher';
import { predictIntent, trainIntentModel } from '@/features/money-questions/domain/question-intent-model';
import { intentBeispieleFuer } from '../paraphrases';
import { resolveKategorieAusText } from '@/features/money-questions/domain/question-category-resolution';
import { findeKonzeptKategorien } from '@/lib/category-concepts';
import type { Category } from '@/types';
import { questionCatalog } from '../question-catalog';
import { WELLE1_KORPUS } from './wave1-corpus';
import { translations } from '@/i18n/translations';

/**
 * Die Ratsche der Welle 1 — das Abnahmekriterium für die Fragekategorien,
 * die diese Welle abdeckt.
 *
 * Gemessen wird `routeFrage`, also exakt die Entscheidung der Fläche. Zwei
 * getrennte Quoten, weil sie verschiedene Fragen beantworten:
 *
 * - **Muster** (die Satzmuster des Auftrags): Pflicht. Sie sind die
 *   Zusage „diese Fragen sind beantwortbar".
 * - **Varianten** (getippt wie von Menschen): Der Beweis, dass der Router
 *   die ABSICHT erkennt und nicht die Schablone auswendig kann. Darf etwas
 *   niedriger liegen — aber nie beliebig, sonst ist die Zusage nichts wert.
 *
 * Zuversichtlich falsch bleibt in BEIDEN Sorten bei null: Eine falsche Zahl
 * ist schlimmer als keine, das ändert sich mit dem Auftrag nicht.
 */

const JETZT = new Date('2026-08-23T12:00:00Z');

/** Kategorien, mit denen der Korpus spricht — inklusive der Oberbegriffs-Achsen. */
const KATEGORIEN = [
  ['c-lebensmittel', 'Lebensmittel'],
  ['c-restaurants', 'Restaurants'],
  ['c-lieferdienste', 'Lieferdienste'],
  ['c-freizeit', 'Freizeit'],
  ['c-shopping', 'Shopping'],
  ['c-wohnen', 'Wohnen'],
  ['c-strom', 'Strom'],
  ['c-moebel', 'Möbel'],
  ['c-mobilitaet', 'Mobilität'],
  ['c-tanken', 'Tanken'],
  ['c-parken', 'Parken'],
  ['c-carsharing', 'Carsharing'],
  ['c-fixkosten', 'Fixkosten'],
].map(([id, name]) => ({ id, name, filters: [], user_id: 'local' }) as unknown as Category);

const HAENDLER = ['aldi', 'lidl', 'rewe', 'edeka', 'amazon', 'zalando', 'dm', 'rossmann'];

function ausloeserWorte(key: string): string[] {
  let knoten: unknown = translations.de;
  for (const teil of key.split('.')) {
    knoten = (knoten as Record<string, unknown> | undefined)?.[teil];
  }
  return typeof knoten === 'string' ? zerlegeAusloeser(knoten) : [];
}

const vokabular: QuestionVocabulary = {
  kategorien: KATEGORIEN.map((c) => ({ wort: c.name.toLowerCase(), wert: c.id, label: c.name })),
  konten: [{ wort: 'girokonto', wert: 'acc-1', label: 'Girokonto' }],
  haendler: HAENDLER.map((h) => ({ wort: h, wert: h })),
  ausloeser: new Map(
    questionCatalog.entries.map((e) => [e.id, e.ausloeser.flatMap(ausloeserWorte)]),
  ),
  verstaerker: new Map(
    questionCatalog.entries.map((e) => [e.id, (e.verstaerker ?? []).flatMap(ausloeserWorte)]),
  ),
  kategorieAusText: (text) => {
    const treffer = resolveKategorieAusText(text, KATEGORIEN, [], undefined);
    return treffer ? { categoryId: treffer.categoryId, confidence: treffer.confidence } : null;
  },
  // Oberbegriffe (WP-G): „Tanken" und „Strom" sind eigene Kategorien, aber
  // „Mobilität" und „Wohnen" spannen darüber — genau der Fall, für den die
  // Konzepttabelle existiert.
  konzeptAusText: (text) => findeKonzeptKategorien(text, KATEGORIEN, 'de')?.categoryIds ?? null,
};

const INTENT_MODELL = trainIntentModel(intentBeispieleFuer('de'));

type Ausgang = 'richtig' | 'sicher' | 'verpasst' | 'falsch';

function klassifiziere(frage: string, familie: string): Ausgang {
  const routing = routeFrage(
    frage,
    vokabular,
    questionCatalog.entries,
    'de',
    JETZT,
    predictIntent(INTENT_MODELL, frage),
  );
  const zielExistiert = familie !== 'luecke' && questionCatalog.byId(familie) !== undefined;

  if (routing.art === 'unverstanden') return zielExistiert ? 'verpasst' : 'richtig';
  if (routing.art === 'kandidaten') {
    if (!zielExistiert) return 'richtig';
    return routing.top.some((k) => k.entryId === familie) ? 'sicher' : 'verpasst';
  }
  return zielExistiert && routing.kandidat.entryId === familie ? 'richtig' : 'falsch';
}

describe('Welle-1-Ratsche', () => {
  const ausgaenge = WELLE1_KORPUS.map((zeile) => ({
    ...zeile,
    ausgang: klassifiziere(zeile.frage, zeile.familie),
  }));

  const quote = (art: 'muster' | 'variante') => {
    const menge = ausgaenge.filter((x) => x.art === art);
    const gut = menge.filter((x) => x.ausgang === 'richtig' || x.ausgang === 'sicher').length;
    return gut / menge.length;
  };
  const falsch = ausgaenge.filter((x) => x.ausgang === 'falsch').length;

  it('sollte den vollständigen Welle-1-Korpus vermessen', () => {
    expect(WELLE1_KORPUS.length).toBeGreaterThanOrEqual(50);
  });

  it('[REGRESSION] die Mustersätze des Auftrags dürfen nur besser werden', () => {
    // Beim Fallen NENNT die Ratsche die Zeile. Eine Quote allein sagt „97 %"
    // und lässt den nächsten Leser suchen; die Zeile sagt, WAS der Router
    // nicht mehr trifft — und ob das eine Regression oder eine ehrlichere
    // Messung ist.
    const gefallen = ausgaenge
      .filter((x) => x.art === 'muster' && x.ausgang !== 'richtig' && x.ausgang !== 'sicher')
      .map((x) => `${x.frage} -> ${x.familie} (${x.ausgang})`);
    expect(quote('muster'), gefallen.join(' | ')).toBeGreaterThanOrEqual(MIN_MUSTER);
  });

  it('[REGRESSION] die getippten Varianten dürfen nur besser werden', () => {
    expect(quote('variante')).toBeGreaterThanOrEqual(MIN_VARIANTE);
  });

  it('[REGRESSION] bei den Mustersätzen bleibt zuversichtlich falsch bei NULL', () => {
    // Die harte Zusage des Auftrags: Was in den Satzmustern steht, wird
    // richtig beantwortet oder präzise nachgefragt — nie falsch.
    const falschInMustern = ausgaenge.filter(
      (x) => x.art === 'muster' && x.ausgang === 'falsch',
    ).length;
    expect(falschInMustern).toBe(0);
  });

  it('[REGRESSION] auch bei den Varianten darf falsch nur sinken', () => {
    expect(falsch).toBeLessThanOrEqual(MAX_FALSCH);
  });

  it('sollte die Fehlschläge benennen, wenn eine Ratsche reißt', () => {
    // Reine Diagnose ohne eigenen Ratschen-Wert: Wer eine Quote anfasst,
    // sieht hier ohne Debugger, WELCHE Fragen kippen.
    const kaputt = ausgaenge.filter((x) => x.ausgang === 'falsch' || x.ausgang === 'verpasst');
    const uebersicht = kaputt
      .map((x) => {
        const r = routeFrage(
          x.frage,
          vokabular,
          questionCatalog.entries,
          'de',
          JETZT,
          predictIntent(INTENT_MODELL, x.frage),
        );
        const wahl =
          r.art === 'aufloesen'
            ? r.kandidat.entryId
            : r.art === 'kandidaten'
              ? `auswahl(${r.top.map((k) => k.entryId).join('|')})`
              : 'unverstanden';
        return `${x.ausgang}: ${wahl} STATT ${x.familie} ← „${x.frage}"`;
      })
      .join('\n');
    if (uebersicht) console.log(uebersicht);
    expect(uebersicht.length).toBeGreaterThanOrEqual(0);
  });
});

// Gemessene Stände — Erstmessung nach dem Bau der acht Kennzahl- und
// Vergleichs-Einträge. Wie bei der 243er-Ratsche gilt: gemessen, nicht
// gewünscht; jede Anhebung braucht einen Grund.
//
// - **Muster: 100 %, davon 0 falsch.** Die Zusage des Auftrags ist für die
//   Satzmuster eingelöst.
// - **Varianten: 88 % (15/17), 1 falsch.** Zwei benannte Reste, beide
//   getippte Umgangssprache:
//   1. „strom im monat wieviel ungefähr" landet in der Auswahl zwischen
//      Kategorie-Summe und Monatsdurchschnitt — die Frage IST zwischen
//      beidem mehrdeutig („im Monat" kann den Zeitraum oder die Normierung
//      meinen), und eine Auswahl ist darauf die ehrliche Antwort.
//   2. „wie is der verlauf bei meinen shoppingkosten" geht zur Prognose
//      statt zur Historie. „Verlauf" trägt beide Bedeutungen; sie sauber zu
//      trennen braucht die Bezugsgrößen-Prüfung, die Welle 3 mitbringt.
const MIN_MUSTER = 1;
// 0.88 → 0.90: gemessen nach dem Satzklammer-Fix (27.08.). Eine Schwelle
// unter dem Stand misst nichts — sie dokumentiert nur, dass jemand
// einmal vorsichtig war (AGENTS.md §3).
const MIN_VARIANTE = 0.9;
const MAX_FALSCH = 1;
