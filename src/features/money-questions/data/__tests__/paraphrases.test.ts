import { describe, expect, it } from 'vitest';
import { paraphrasenFuer } from '../paraphrases';
import { questionCatalog } from '../question-catalog';
import { LUECKE_KLASSE } from '@/lib/question-intent-model';
import { EVAL_KORPUS } from './question-eval-corpus';

/**
 * Kurations-Wächter des Paraphrasen-Korpus. Die zwei Regeln aus dem Kopf von
 * `paraphrases/de.ts`, maschinell erzwungen — Regeln ohne Wächter sind
 * Absichtserklärungen.
 */

const MINDESTZAHL: Record<string, number> = { de: 8, en: 3, ru: 3 };

describe('Paraphrasen-Korpus', () => {
  it('sollte jede Katalog-Familie in jeder Sprache mit Mindestbestand abdecken', () => {
    // Deutsch trägt die Kalibrierung (das gemessene Korpus ist deutsch); die
    // kleineren en/ru-Minima sind eine BENANNTE Asymmetrie, kein Versehen.
    for (const [locale, minimum] of Object.entries(MINDESTZAHL)) {
      const paraphrasen = paraphrasenFuer(locale);
      for (const entry of questionCatalog.entries) {
        expect(
          paraphrasen[entry.id]?.length ?? 0,
          `${locale}: ${entry.id}`,
        ).toBeGreaterThanOrEqual(minimum);
      }
      expect(
        paraphrasen[LUECKE_KLASSE]?.length ?? 0,
        `${locale}: ${LUECKE_KLASSE}`,
      ).toBeGreaterThanOrEqual(minimum);
    }
  });

  it('sollte keine verwaiste Familie führen — jede Klasse existiert im Katalog', () => {
    // Ein Tippfehler in der Klassen-ID wäre sonst stumm: Die Paraphrasen
    // trainierten eine Klasse, die nie jemand vorschlagen kann.
    for (const locale of Object.keys(MINDESTZAHL)) {
      for (const klasse of Object.keys(paraphrasenFuer(locale))) {
        if (klasse === LUECKE_KLASSE) continue;
        expect(questionCatalog.byId(klasse), `${locale}: ${klasse}`).toBeDefined();
      }
    }
  });

  it('[REGRESSION] sollte KEINEN Satz aus dem Eval-Korpus enthalten', () => {
    // Der Korpus ist der TEST der Stufe 2. Wer auf dem Test trainiert, misst
    // Auswendiglernen statt Verstehen — die Ratsche wäre ab dann bedeutungslos.
    const verboten = new Set(EVAL_KORPUS.map((z) => z.frage.toLowerCase().replace(/[^a-zäöüß0-9]+/g, ' ').trim()));
    for (const locale of Object.keys(MINDESTZAHL)) {
      for (const texte of Object.values(paraphrasenFuer(locale))) {
        for (const text of texte) {
          const normiert = text.toLowerCase().replace(/[^a-zäöüß0-9]+/g, ' ').trim();
          expect(verboten.has(normiert), `„${text}"`).toBe(false);
        }
      }
    }
  });
});
