import { describe, expect, it } from 'vitest';
import {
  entscheideRouting,
  lexicalQuestionMatcher,
  type QuestionVocabulary,
} from '@/lib/question-matcher';
import { resolveKategorieAusText } from '@/lib/question-category-resolution';
import type { Category } from '@/types';
import { questionCatalog } from '../question-catalog';
import { EVAL_KORPUS } from './question-eval-corpus';
import { translations } from '@/i18n/translations';

/**
 * Die Ratsche des Routers — das Abnahmekriterium von WP-F.
 *
 * Gemessen wird nicht die Kandidatenliste, sondern die ENTSCHEIDUNG
 * (`entscheideRouting`), also genau das, was die Fläche tut. Vier Ausgänge
 * je Frage, klassifiziert gegen die Ziel-Familie aus dem Korpus:
 *
 * - **richtig** — der Router landet in der Ziel-Familie (Antwort oder
 *   Slot-Rückfrage), bzw. er hält sich bei einer benannten Lücke zurück.
 * - **sicher** — die Ziel-Familie steht unter den angebotenen Kandidaten
 *   einer Rückfrage. Eine präzise Rückfrage zählt laut Auftrag als korrekt.
 * - **verpasst** — ehrliche Abstinenz bei einer beantwortbaren Frage. Kein
 *   Schaden, aber kein Nutzen; zählt gegen die obere Quote.
 * - **zuversichtlich falsch** — der Router beantwortet die FALSCHE Frage
 *   oder beantwortet eine Lücke. Der einzige wirklich schädliche Ausgang:
 *   Eine falsche Zahl ist schlimmer als keine.
 *
 * Beide Quoten sind Ratschen: `richtigOderSicher` darf nur STEIGEN,
 * `zuversichtlichFalsch` nur SINKEN. Jede Anpassung braucht einen Kommentar
 * mit Grund (Vorbild: `call-site-keys.test.ts`). Zielwerte laut Auftrag:
 * ≥ 99 % bzw. ≤ 1 %.
 *
 * Der Korpus nennt ZIEL-Familien, auch für noch nicht gebaute Einträge; die
 * Erwartung leitet sich daraus ab, ob der Eintrag im Katalog existiert.
 * Damit verschärft der Bau einer Familie die Messung automatisch — nichts
 * muss umgelabelt werden (Details im Kopf von `question-eval-corpus.ts`).
 */

const JETZT = new Date('2026-08-23T12:00:00Z');

/** Typische Nutzer-Kategorien — die Namen, mit denen der Korpus spricht. */
const KATEGORIEN = [
  ['c-lebensmittel', 'Lebensmittel'],
  ['c-freizeit', 'Freizeit'],
  ['c-restaurants', 'Restaurants'],
  ['c-kleidung', 'Kleidung'],
  ['c-wohnen', 'Wohnen'],
  ['c-mobilitaet', 'Auto & Mobilität'],
  ['c-urlaub', 'Urlaub & Reisen'],
  ['c-kinder', 'Kinder'],
  ['c-shopping', 'Shopping'],
].map(([id, name]) => ({ id, name, user_id: 'local' }) as Category);

function ausloeserWorte(key: string): string[] {
  let knoten: unknown = translations.de;
  for (const teil of key.split('.')) {
    knoten = (knoten as Record<string, unknown> | undefined)?.[teil];
  }
  // Dieselbe Auflösung wie in `use-money-questions.ts`: der Sprachbaum-Wert,
  // per Leerraum zerlegt. Ein nicht auflösbarer Key liefert nichts.
  return typeof knoten === 'string' ? knoten.split(/\s+/).filter(Boolean) : [];
}

function vokabular(): QuestionVocabulary {
  return {
    kategorien: KATEGORIEN.map((c) => ({ wort: c.name.toLowerCase(), wert: c.id, label: c.name })),
    konten: [{ wort: 'girokonto', wert: 'acc-1', label: 'Girokonto' }],
    haendler: [
      { wort: 'lidl', wert: 'lidl' },
      { wort: 'klarna', wert: 'klarna' },
      { wort: 'netflix', wert: 'netflix' },
    ],
    ausloeser: new Map(
      questionCatalog.entries.map((entry) => [
        entry.id,
        entry.ausloeser.flatMap((key) => ausloeserWorte(key)),
      ]),
    ),
    kategorieAusText: (text) => {
      const treffer = resolveKategorieAusText(text, KATEGORIEN, [], undefined);
      return treffer ? { categoryId: treffer.categoryId, confidence: treffer.confidence } : null;
    },
  };
}

type Ausgang = 'richtig' | 'sicher' | 'verpasst' | 'falsch';

function klassifiziere(frage: string, familie: string, vok: QuestionVocabulary): Ausgang {
  const kandidaten = lexicalQuestionMatcher.match(frage, vok, questionCatalog.entries, 'de', JETZT);
  const routing = entscheideRouting(kandidaten);
  const zielExistiert = familie !== 'luecke' && questionCatalog.byId(familie) !== undefined;

  if (routing.art === 'unverstanden') {
    // Abstinenz: bei einer Lücke die richtige Reaktion, bei einer
    // beantwortbaren Frage verschenkter Nutzen — aber nie ein Schaden.
    return zielExistiert ? 'verpasst' : 'richtig';
  }

  // `aufloesen` heisst: Die Fläche behauptet, verstanden zu haben — als
  // Antwort oder als Slot-Rückfrage INNERHALB dieser Familie. Beides ist nur
  // dann in Ordnung, wenn es die richtige Familie ist; eine Slot-Rückfrage
  // der falschen Familie fragt bereits die falsche Frage.
  return zielExistiert && routing.kandidat.entryId === familie ? 'richtig' : 'falsch';
}

describe('Router-Ratsche über den 225-Fragen-Korpus', () => {
  const vok = vokabular();
  const ausgaenge = EVAL_KORPUS.map((zeile) => ({
    ...zeile,
    ausgang: klassifiziere(zeile.frage, zeile.familie, vok),
  }));

  const anzahl = (a: Ausgang) => ausgaenge.filter((x) => x.ausgang === a).length;

  it('sollte den vollständigen Korpus vermessen', () => {
    expect(EVAL_KORPUS).toHaveLength(225);
  });

  it('[REGRESSION] richtigOderSicher darf nur steigen', () => {
    const quote = (anzahl('richtig') + anzahl('sicher')) / EVAL_KORPUS.length;
    // Startwert beim Einführen (F.1): gemessen, nicht gewünscht. Der Weg zur
    // 99-%-Zielmarke läuft über F.2 (Gates), F.3 (Familien) und F.4
    // (Klassifikator) — jede Stufe hebt diese Zahl mit Kommentar an.
    expect(quote).toBeGreaterThanOrEqual(MIN_RICHTIG_ODER_SICHER);
  });

  it('[REGRESSION] zuversichtlichFalsch darf nur sinken', () => {
    const quote = anzahl('falsch') / EVAL_KORPUS.length;
    expect(quote).toBeLessThanOrEqual(MAX_ZUVERSICHTLICH_FALSCH);
  });

  it('sollte die Fehlschläge benennen, wenn eine Ratsche reißt', () => {
    // Kein eigener Ratschen-Wert — reine Diagnose: Wer eine der beiden
    // Quoten anfasst, sieht hier ohne Debugger, WELCHE Fragen kippen.
    const falsche = ausgaenge.filter((x) => x.ausgang === 'falsch').slice(0, 15);
    const uebersicht = falsche.map((x) => `${x.familie} ← „${x.frage}"`).join('\n');
    expect(uebersicht.length, uebersicht).toBeGreaterThanOrEqual(0);
  });
});

// Gemessene Startwerte (F.1): richtig 45 · sicher 0 · verpasst 0 ·
// zuversichtlich falsch 180. Der Stand VOR den Reparaturen, absichtlich
// unbeschönigt festgehalten: Der lexikalische Router beantwortete 80 % des
// Korpus mit der FALSCHEN Funktion, weil Auslösewörter wie „kann ich mir" in
// Stoppwort-Token zerfielen und es kein Marge-Gate gab. Jede Stufe von WP-F
// hebt bzw. senkt diese Werte mit eigenem Kommentar; Ziel laut Auftrag:
// ≥ 0.99 und ≤ 0.01.
const MIN_RICHTIG_ODER_SICHER = 0.2;
const MAX_ZUVERSICHTLICH_FALSCH = 0.8;
