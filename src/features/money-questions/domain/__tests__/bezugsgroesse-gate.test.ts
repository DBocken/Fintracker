/**
 * Wer nach einem TEIL fragt, darf nie das GANZE bekommen.
 *
 * Nutzerfund (Produktion): „Wie gebe ich für netflix aus" wurde mit
 * **5.566,16 € — Alle Ausgaben zusammen, insgesamt. Aus 57 Buchungen**
 * beantwortet. Die Frage nennt einen Händler; die Antwort ist die
 * Gesamtsumme des Bestands. Das ist keine unvollständige Auskunft, sondern
 * eine FALSCHE Zahl mit richtigem Anstrich — die schlimmste Sorte, weil
 * nichts an ihr nach Fehler aussieht.
 *
 * Die Regel dagegen stand längst im Matcher (`hatUnaufgelösteBezugsgroesse`,
 * samt Kommentar „Wer nach einem Teil fragt und das Ganze bekommt, bekommt
 * eine falsche Zahl mit richtigem Anstrich"). Sie war aber nur an EINER
 * Stelle verdrahtet: im Stichentscheid der Stufe 2. Der lexikalische Pfad
 * verlässt `routeFrage` vorher über `if (!intent) return lexikalisch`, und
 * genau dort fiel die Antwort durch.
 *
 * Dieselbe Lehre wie beim Szenario-Gate und beim Imperativ-Gate, zum dritten
 * Mal: **Ein Gate gehört an JEDE Stufe, die es umgehen könnte** — eine
 * Schranke, die nur im Sonderfall geprüft wird, ist im Regelfall keine.
 */
import { describe, expect, it } from 'vitest';
import { routeFrage, zerlegeAusloeser, type QuestionVocabulary } from '@/features/money-questions/domain/question-matcher';
import { predictIntent, trainIntentModel } from '@/features/money-questions/domain/question-intent-model';
import { intentBeispieleFuer } from '@/features/money-questions/data/paraphrases';
import { questionCatalog } from '@/features/money-questions/data/question-catalog';
import { translations } from '@/i18n/translations';

const JETZT = new Date('2026-08-28T12:00:00Z');

function ausloeserWorte(key: string): string[] {
  let knoten: unknown = translations.de;
  for (const teil of key.split('.')) {
    knoten = (knoten as Record<string, unknown> | undefined)?.[teil];
  }
  return typeof knoten === 'string' ? zerlegeAusloeser(knoten) : [];
}

/** Vokabular OHNE Netflix — genau die Lage des Nutzers. */
const OHNE_NETFLIX: QuestionVocabulary = {
  kategorien: [],
  konten: [],
  haendler: [{ wort: 'rewe', wert: 'rewe' }],
  ausloeser: new Map(
    questionCatalog.entries.map((e) => [e.id, e.ausloeser.flatMap(ausloeserWorte)]),
  ),
  verstaerker: new Map(
    questionCatalog.entries.map((e) => [e.id, (e.verstaerker ?? []).flatMap(ausloeserWorte)]),
  ),
};

/** Dasselbe Vokabular, aber Netflix ist bekannt. */
const MIT_NETFLIX: QuestionVocabulary = {
  ...OHNE_NETFLIX,
  haendler: [...OHNE_NETFLIX.haendler, { wort: 'netflix', wert: 'netflix' }],
};

const route = (frage: string, vok: QuestionVocabulary) =>
  routeFrage(frage, vok, questionCatalog.entries, 'de', JETZT);

/**
 * Der Router MIT Stufe 2 — und zwar so, wie die Fläche ihn benutzt: aus den
 * kuratierten Paraphrasen PLUS den eigenen Bestätigungen des Nutzers.
 *
 * Genau hier lag der Nutzerfund: Wer einmal bei einer Händlerfrage
 * „Alle Ausgaben" antippt, lehrt der App diese Zuordnung. Beim nächsten Mal
 * trägt die gelernte Formulierung die Antwort ALLEIN — und ohne Gate wird
 * daraus stillschweigend die Gesamtsumme.
 */
function routeMitGelerntem(frage: string, vok: QuestionVocabulary, gelernt: { klasse: string; text: string }[]) {
  const modell = trainIntentModel([...intentBeispieleFuer('de'), ...gelernt]);
  return routeFrage(frage, vok, questionCatalog.entries, 'de', JETZT, predictIntent(modell, frage));
}

/** Wie ein Nutzer, der die falsche Karte mehrfach angetippt hat. */
const FALSCH_GELERNT = [
  'wie gebe ich für netflix aus',
  'wieviel gebe ich für netflix aus',
  'was gebe ich für netflix aus',
  'wie viel gebe ich für netflix aus',
].map((text) => ({ klasse: 'ausgaben.gesamt', text }));

/** Einträge, die OHNE Pflicht-Slot über den ganzen Bestand summieren. */
function istGesamtEintrag(entryId: string): boolean {
  const eintrag = questionCatalog.byId(entryId);
  return eintrag !== undefined && eintrag.slots.erforderlich.length === 0;
}

describe('Gate: genannte, aber unaufgelöste Bezugsgröße', () => {
  it('[REGRESSION] sollte NICHT die Gesamtsumme liefern, wenn ein unbekannter Händler genannt ist', () => {
    const r = route('Wie gebe ich für netflix aus', OHNE_NETFLIX);

    if (r.art === 'aufloesen') {
      expect(
        istGesamtEintrag(r.kandidat.entryId),
        `„für netflix" wurde mit dem Gesamtbestand beantwortet (${r.kandidat.entryId})`,
      ).toBe(false);
    }
    // DER Kern des Nutzerfunds: Auch das ANGEBOT darf das Ganze nicht
    // enthalten. „Alle Ausgaben zusammen" stand dort an erster Stelle, und
    // ein Angebot ist kein harmloserer Fall als eine Antwort — es führt nur
    // einen Klick später zu derselben falschen Zahl.
    if (r.art === 'kandidaten') {
      expect(
        r.top.map((k) => k.entryId).filter(istGesamtEintrag),
        'die Auswahl bot einen Gesamt-Eintrag an',
      ).toEqual([]);
      expect(r.top.length, 'die Auswahl ist leer statt hilfreich').toBeGreaterThan(0);
    }
  });

  it('[REGRESSION] sollte auch bei „bei" die Gesamtsumme verweigern', () => {
    const r = route('Wieviel habe ich bei quastelhuber ausgegeben', OHNE_NETFLIX);
    if (r.art === 'aufloesen') {
      expect(istGesamtEintrag(r.kandidat.entryId)).toBe(false);
    }
    if (r.art === 'kandidaten') {
      expect(r.top.map((k) => k.entryId).filter(istGesamtEintrag)).toEqual([]);
    }
  });

  it('sollte den bekannten Händler weiterhin direkt beantworten', () => {
    // Der Anker: Das Gate darf den funktionierenden Weg nicht zerstören.
    const r = route('Wie gebe ich für netflix aus', MIT_NETFLIX);
    expect(r.art).toBe('aufloesen');
    if (r.art !== 'aufloesen') return;
    expect(r.kandidat.entryId).toBe('ausgaben.haendler');
    expect(r.kandidat.slots.haendler).toBe('netflix');
  });

  it('[REGRESSION] sollte die Gesamtsumme auch dann verweigern, wenn sie GELERNT wurde', () => {
    // Der eigentliche Nutzerfund: Über den Stufe-2-Ausgang „gelernte
    // Formulierung trägt allein" antwortete der Router direkt — und dieser
    // Ausgang prüfte die Bezugsgrößen-Schranke nie.
    const r = routeMitGelerntem('Wie gebe ich für netflix aus', OHNE_NETFLIX, FALSCH_GELERNT);

    if (r.art === 'aufloesen') {
      expect(
        istGesamtEintrag(r.kandidat.entryId),
        `gelernte Zuordnung lieferte den Gesamtbestand (${r.kandidat.entryId})`,
      ).toBe(false);
    }
    if (r.art === 'kandidaten') {
      expect(r.top.map((k) => k.entryId).filter(istGesamtEintrag)).toEqual([]);
    }
  });

  it('sollte die ECHTE Gesamtfrage weiterhin beantworten', () => {
    // „Wieviel habe ich ausgegeben?" IST die Frage nach dem Ganzen — hier
    // ist keine Bezugsgröße genannt, das Gate darf nicht anspringen.
    const r = route('Wieviel habe ich insgesamt ausgegeben', OHNE_NETFLIX);
    expect(r.art).toBe('aufloesen');
    if (r.art !== 'aufloesen') return;
    expect(istGesamtEintrag(r.kandidat.entryId)).toBe(true);
  });
});
