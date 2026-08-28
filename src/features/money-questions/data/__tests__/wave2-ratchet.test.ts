import { describe, expect, it } from 'vitest';
import { routeFrage, zerlegeAusloeser, type QuestionVocabulary } from '@/features/money-questions/domain/question-matcher';
import { predictIntent, trainIntentModel } from '@/features/money-questions/domain/question-intent-model';
import { intentBeispieleFuer } from '../paraphrases';
import { resolveKategorieAusText } from '@/features/money-questions/domain/question-category-resolution';
import { findeKonzeptKategorien } from '@/lib/category-concepts';
import type { Category } from '@/types';
import { questionCatalog } from '../question-catalog';
import { WELLE2_KORPUS } from './wave2-corpus';
import { translations } from '@/i18n/translations';

/**
 * Die Ratsche der Welle 2 — Konten, Vermögen, Depots, Anlässe, Transfers,
 * Steuer.
 *
 * Gemessen wird `routeFrage`, also exakt die Entscheidung der Fläche; Aufbau
 * und Quoten wie bei der Welle-1-Ratsche (Begründung dort). Neu ist das
 * Anlass-Vokabular: Die Fläche baut es aus den eigenen Anlässen, und ohne es
 * hätte eine Anlass-Frage hier keinen Slot zu füllen — der Korpus mäße dann
 * die Rückfrage statt der Erkennung.
 *
 * Der Block „benannte Grenzen" am Korpus-Ende ist kein Beiwerk: Umsatzsteuer,
 * Fremdwährung und Vermögens-Historie bleiben bewusst unbeantwortet
 * (§ 19 UStG, VE-1, fehlende Zeitreihe). Dass der Chat sich dort
 * ZURÜCKHÄLT, ist damit gemessen und nicht bloß behauptet.
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
  konten: [
    { wort: 'girokonto', wert: 'acc-1', label: 'Girokonto' },
    { wort: 'sparkonto', wert: 'acc-2', label: 'Sparkonto' },
  ],
  haendler: HAENDLER.map((h) => ({ wort: h, wert: h })),
  // Wie in der Fläche aus den eigenen Anlässen gebaut.
  anlaesse: [
    { wort: 'urlaub italien', wert: 'ev-urlaub', label: 'Urlaub Italien' },
    { wort: 'hochzeit', wert: 'ev-hochzeit', label: 'Hochzeit' },
  ],
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

describe('Welle-2-Ratsche', () => {
  const ausgaenge = WELLE2_KORPUS.map((zeile) => ({
    ...zeile,
    ausgang: klassifiziere(zeile.frage, zeile.familie),
  }));

  const quote = (art: 'muster' | 'variante') => {
    const menge = ausgaenge.filter((x) => x.art === art);
    const gut = menge.filter((x) => x.ausgang === 'richtig' || x.ausgang === 'sicher').length;
    return gut / menge.length;
  };
  const falsch = ausgaenge.filter((x) => x.ausgang === 'falsch').length;

  it('sollte den vollständigen Welle-2-Korpus vermessen', () => {
    expect(WELLE2_KORPUS.length).toBeGreaterThanOrEqual(50);
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

// Gemessene Stände — Erstmessung nach dem Bau der vierzehn Welle-2-Einträge.
// Gemessen, nicht gewünscht; jede Anhebung braucht einen Grund.
//
// - **Muster: 100 %, davon 0 falsch.**
// - **Varianten: 100 %, 0 falsch.** Höher als in Welle 1 (88 %), und das hat
//   einen nüchternen Grund statt eines schmeichelhaften: Die Welle-2-Fragen
//   nennen fast immer ein Substantiv, das nur EIN Thema haben kann („Depot",
//   „Girokonto", „Steuerrücklage", ein selbst vergebener Anlassname). Welle 1
//   musste dagegen Rechenarten auf derselben Bezugsgröße unterscheiden — „im
//   Monat" heisst Zeitraum ODER Normierung, und das ist ehrlich mehrdeutig.
//
// Vier Fehlschläge waren auf dem Weg dorthin zu beheben, und zwei davon
// waren strukturell (siehe Commit): die Gewichtung des Anlass-Slots und die
// Funktionswort-Regel für PHRASEN. Die anderen zwei waren Auslöser, die als
// zusammenhängende Phrase nie treffen konnten („setzt sich zusammen" — im
// Satz stehen Wörter dazwischen), also derselbe Fehler wie in Welle 1.
const MIN_MUSTER = 1;
const MIN_VARIANTE = 1;
const MAX_FALSCH = 0;
