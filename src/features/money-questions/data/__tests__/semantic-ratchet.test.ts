/**
 * Die Ratsche der Router-Stufe 3 — gemessen OHNE Modell-Download, über die
 * eingefrorenen Embeddings aus `semantic-fixture.json`.
 *
 * Gemessen wird die einzige Rolle, die die Stufe hat: das RESIDUUM — die
 * Korpuszeilen, bei denen Stufe 0–2 leer ausgehen (unverstanden oder blosse
 * Vermutung). Auf den Zeilen, die der deterministische Router versteht,
 * läuft Stufe 3 nie; sie dort zu messen wäre die Messung einer Stufe, die
 * nicht dran ist.
 *
 * Drei Zusicherungen:
 * 1. **top-3 auf dem beantwortbaren Residuum** darf nur steigen. Die Stufe
 *    bietet eine AUSWAHL an — die Soll-Familie muss darunter sein.
 * 2. **Lücken-Vorschlagsrate** darf nur sinken: Wie oft bietet die Stufe zu
 *    einer BENANNTEN Lücke überhaupt Vorschläge an. Eine Auswahl ist keine
 *    falsche Zahl, aber eine Stufe, die zu allem etwas anbietet, entwertet
 *    ihre Vorschläge.
 * 3. **Kein Aktions-Vorschlag, nie** — das Schreib-Gate der Grammatiken gilt
 *    an jeder Stufe (AGENTS.md §3).
 *
 * Passt die Fixture nicht mehr zum Stand (neue Paraphrase, neue Korpuszeile),
 * fällt der Hash-Wächter mit dem Regenerier-Befehl — sonst mässe die Ratsche
 * still gegen veraltete Embeddings.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'crypto';
import fixture from './semantic-fixture.json';
import { paraphrasenFuer, intentBeispieleFuer } from '../paraphrases';
import { EVAL_KORPUS } from './question-eval-corpus';
import { WELLE1_KORPUS } from './wave1-corpus';
import { WELLE2_KORPUS } from './wave2-corpus';
import { WELLE3_KORPUS } from './wave3-corpus';
import { WELLE5_KORPUS } from './wave5-corpus';
import { alleKorpusZeilen, fixtureHashQuelle } from './semantic-shared';
import {
  semantischeVorschlaege,
  vektorAusBase64,
  type SemantischeKlasse,
} from '@/lib/semantic-intent';
import { routeFrage, zerlegeAusloeser, type QuestionVocabulary } from '@/lib/question-matcher';
import { predictIntent, trainIntentModel } from '@/lib/question-intent-model';
import { resolveKategorieAusText } from '@/lib/question-category-resolution';
import { questionCatalog } from '../question-catalog';
import { translations } from '@/i18n/translations';
import type { Category } from '@/types';

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
  return typeof knoten === 'string' ? zerlegeAusloeser(knoten) : [];
}

const VOKABULAR: QuestionVocabulary = {
  kategorien: KATEGORIEN.map((c) => ({ wort: c.name.toLowerCase(), wert: c.id, label: c.name })),
  konten: [{ wort: 'girokonto', wert: 'acc-1', label: 'Girokonto' }],
  haendler: [
    { wort: 'lidl', wert: 'lidl' },
    { wort: 'klarna', wert: 'klarna' },
    { wort: 'netflix', wert: 'netflix' },
    { wort: 'rewe', wert: 'rewe' },
    { wort: 'aldi', wert: 'aldi' },
    { wort: 'amazon', wert: 'amazon' },
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
};

const MODELL = trainIntentModel(intentBeispieleFuer('de'));
const ZEILEN = alleKorpusZeilen(
  EVAL_KORPUS,
  WELLE1_KORPUS,
  WELLE2_KORPUS,
  WELLE3_KORPUS,
  WELLE5_KORPUS,
);

const KLASSEN: SemantischeKlasse[] = Object.entries(fixture.klassen).map(([klasse, b64s]) => ({
  klasse,
  vektoren: (b64s as string[]).map(vektorAusBase64),
}));
const KLASSEN_NAMEN = new Set(KLASSEN.map((k) => k.klasse));

/** Das Residuum: was Stufe 0–2 nicht (belastbar) verstehen. */
function residuum(): { frage: string; familie: string }[] {
  return ZEILEN.filter(({ frage }) => {
    const r = routeFrage(
      frage,
      VOKABULAR,
      questionCatalog.entries,
      'de',
      new Date('2026-08-23T12:00:00Z'),
      predictIntent(MODELL, frage),
    );
    return (
      r.art === 'unverstanden' ||
      (r.art === 'kandidaten' && (r as { nurVermutung?: boolean }).nurVermutung === true)
    );
  });
}

describe('Semantische Ratsche (Router-Stufe 3)', () => {
  it('[REGRESSION] die Fixture passt zum Stand von Paraphrasen und Korpora', () => {
    const hash = createHash('sha256')
      .update(fixtureHashQuelle(paraphrasenFuer('de'), ZEILEN))
      .digest('hex');
    expect(
      fixture.hash,
      'Fixture veraltet — neu erzeugen: SEMANTIC_FIXTURE=1 pnpm vitest run src/features/money-questions/data/__tests__/semantic-fixture.generate.test.ts',
    ).toBe(hash);
  });

  it('[REGRESSION] top-3 auf dem beantwortbaren Residuum darf nur steigen', () => {
    const rest = residuum();
    const beantwortbar = rest.filter((z) => KLASSEN_NAMEN.has(z.familie));
    expect(beantwortbar.length).toBeGreaterThan(20);

    const daneben: string[] = [];
    let treffer = 0;
    for (const { frage, familie } of beantwortbar) {
      const b64 = (fixture.fragen as Record<string, string>)[frage];
      expect(b64, `Frage fehlt in der Fixture: ${frage}`).toBeTypeOf('string');
      const vorschlaege = semantischeVorschlaege(vektorAusBase64(b64), KLASSEN);
      if (vorschlaege.some((v) => v.klasse === familie)) treffer += 1;
      else daneben.push(`${frage} -> [${vorschlaege.map((v) => v.klasse).join(', ')}] soll ${familie}`);
    }
    // Gemessen bei Einführung: 36/37 = 0.97. Die Schwelle steht auf dem
    // GEMESSENEN Stand (AGENTS.md §3) — und die Fehlermeldung nennt die
    // gefallene Zeile.
    expect(treffer / beantwortbar.length, daneben.join(' | ')).toBeGreaterThanOrEqual(0.97);
  });

  it('[REGRESSION] die Lücken-Vorschlagsrate darf nur sinken', () => {
    const rest = residuum();
    const luecken = rest.filter((z) => !KLASSEN_NAMEN.has(z.familie));
    expect(luecken.length).toBeGreaterThan(50);

    let mitVorschlag = 0;
    for (const { frage } of luecken) {
      const b64 = (fixture.fragen as Record<string, string>)[frage];
      if (!b64) continue;
      if (semantischeVorschlaege(vektorAusBase64(b64), KLASSEN).length > 0) mitVorschlag += 1;
    }
    // Gemessen bei Einführung: 93/97. e5 komprimiert Ähnlichkeiten so
    // stark, dass auch verwandte Lücken-Fragen über der Schwelle liegen —
    // ein Vorschlag zu einer Lücke ist eine antippbare Rückfrage, keine
    // falsche Zahl, und der Nutzer wählt die Umformulierung selbst. Die
    // Ratsche hält fest, dass es nicht MEHR werden.
    expect(mitVorschlag / luecken.length).toBeLessThanOrEqual(0.96);
  });

  it('[SECURITY] schlägt NIE eine Aktions-Klasse vor — an keiner Frage', () => {
    // Strukturell sind die Paraphrasen frei von Aktions-Klassen; dieser Test
    // hält beides fest: die Struktur UND den defensiven Filter der Stufe.
    for (const k of KLASSEN) expect(k.klasse.endsWith('.aktion'), k.klasse).toBe(false);
    for (const b64 of Object.values(fixture.fragen as Record<string, string>)) {
      const vorschlaege = semantischeVorschlaege(vektorAusBase64(b64), [
        ...KLASSEN,
        { klasse: 'budget.aktion', vektoren: KLASSEN[0].vektoren },
      ]);
      expect(vorschlaege.some((v) => v.klasse.endsWith('.aktion'))).toBe(false);
    }
  });
});
