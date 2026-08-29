import { describe, it, expect } from 'vitest';
import {
  createQuestionRegistry,
  fehlendeSlots,
  type QuestionEntry,
} from '@/features/shared/domain/question-registry';
import { lexicalQuestionMatcher } from '@/features/money-questions/domain/question-matcher';
import type { QuestionVocabulary } from '@/features/money-questions/domain/question-matcher';

const JETZT = new Date('2026-07-20T12:00:00Z');

function eintrag(id: string, over: Partial<QuestionEntry> = {}): QuestionEntry {
  return {
    id,
    slots: { erforderlich: [], optional: [] },
    ausloeser: [],
    needs: [],
    aufwand: 'guenstig',
    antwort: () => ({
      art: 'anzahl',
      wert: 1,
      anzahl: 1,
      aussage: { key: 'x', params: {} },
      deepLink: '/',
      deepLinkArt: 'kontext',
    }),
    ...over,
  };
}

describe('createQuestionRegistry', () => {
  it('sollte doppelte IDs abweisen statt still zu überschreiben', () => {
    // Der spätere Eintrag gewänne, der frühere verschwände wortlos — dieselbe
    // Falle wie der doppelte i18n-Namespace (AGENTS.md §6).
    expect(() => createQuestionRegistry([eintrag('a'), eintrag('a')])).toThrow(/duplicate ids/);
  });

  it('sollte nach ID sortieren, damit die Reihenfolge nicht vom Bundler abhängt', () => {
    const register = createQuestionRegistry([eintrag('z'), eintrag('a'), eintrag('m')]);
    expect(register.entries.map((e) => e.id)).toEqual(['a', 'm', 'z']);
  });

  it('sollte nur die Bedürfnisse der gefragten Einträge nennen', () => {
    const register = createQuestionRegistry([
      eintrag('a', { needs: ['transactions', 'categories'] }),
      eintrag('b', { needs: ['debts'] }),
    ]);

    expect(register.needsFor(['a'])).toEqual(['categories', 'transactions']);
    expect(register.needsFor(['a', 'b'])).toEqual(['categories', 'debts', 'transactions']);
    expect(register.needsFor([])).toEqual([]);
  });

  it('sollte fehlende Pflicht-Slots melden, optionale aber nicht', () => {
    const e = eintrag('a', { slots: { erforderlich: ['haendler', 'betrag'], optional: ['zeitraum'] } });

    expect(fehlendeSlots(e, {})).toEqual(['haendler', 'betrag']);
    expect(fehlendeSlots(e, { haendler: 'lidl' })).toEqual(['betrag']);
    expect(fehlendeSlots(e, { haendler: 'lidl', betrag: 10 })).toEqual([]);
  });
});

/**
 * Der Test, der die ganze Bauform absichert.
 *
 * Das Versprechen von WP-C/WP-D lautet: „Eine neue beantwortbare Frage ist ein
 * Registereintrag neben dem Feature — die Chat-Fläche wird dabei nicht
 * angefasst." Ohne diesen Test wäre das eine Behauptung im Kommentar. Hier
 * wird ein Attrappen-Eintrag registriert und über denselben Weg beantwortet,
 * den die Fläche geht (Matcher → Eintrag → Antwort), ohne dass irgendwo eine
 * Fallunterscheidung auf seine ID nötig wäre.
 */
describe('Eine neue Frage braucht keine Änderung am Verteiler', () => {
  it('sollte einen frisch registrierten Eintrag über den normalen Weg beantworten', () => {
    const neuerEintrag = eintrag('vollkommen.neue.frage', {
      slots: { erforderlich: ['haendler'], optional: ['zeitraum'] },
      ausloeser: ['schrauben'],
      antwort: (slots) => ({
        art: 'anzahl',
        wert: 42,
        anzahl: 42,
        aussage: { key: 'neu.aussage', params: { haendler: slots.haendler ?? '' } },
        deepLink: '/irgendwo',
        deepLinkArt: 'kontext',
      }),
    });

    const register = createQuestionRegistry([eintrag('bestehend'), neuerEintrag]);
    const vokabular: QuestionVocabulary = {
      kategorien: [],
      konten: [],
      haendler: [{ wort: 'baumarkt', wert: 'baumarkt' }],
      ausloeser: new Map([['vollkommen.neue.frage', ['schrauben']]]),
    };

    // Genau der Ablauf der Fläche — nur ohne React.
    const [beste] = lexicalQuestionMatcher.match(
      'schrauben beim baumarkt',
      vokabular,
      register.entries,
      'de',
      JETZT,
    );

    expect(beste.entryId).toBe('vollkommen.neue.frage');
    expect(beste.fehlend).toEqual([]);

    const antwort = register.byId(beste.entryId)!.antwort(beste.slots, { jetzt: JETZT });

    expect(antwort.wert).toBe(42);
    expect(antwort.aussage.params.haendler).toBe('baumarkt');
  });
});
