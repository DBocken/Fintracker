import { describe, expect, it } from 'vitest';
import { paraphrasenFuer } from '../paraphrases';
import { questionCatalog } from '../question-catalog';
import { LUECKE_KLASSE } from '@/features/money-questions/domain/question-intent-model';
import { istAktionsEintrag } from '@/features/shared/domain/question-registry';
import { EVAL_KORPUS } from './question-eval-corpus';
import { WELLE1_KORPUS } from './wave1-corpus';
import { WELLE2_KORPUS } from './wave2-corpus';
import { WELLE3_KORPUS } from './wave3-corpus';
import { WELLE5_KORPUS } from './wave5-corpus';

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
        // Aktions-Einträge sind ausgenommen, und das ist keine Nachsicht,
        // sondern die Folge einer Sperre: Sie sind für Stufe 2 gesperrt, weil
        // die kein Imperativ-Gate hat (`istAktionsEintrag`). Paraphrasen für
        // sie hätten also keinen Weg in eine Antwort — sie würden nur die
        // übrigen Klassen verdünnen, und genau das war beim Bau der Welle 5
        // messbar: Drei Aktions-Klassen kosteten zwei Bestandsratschen ihre
        // 100 %.
        if (istAktionsEintrag(entry)) continue;
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

  it('[REGRESSION] sollte KEINEN Satz aus einem der fünf Korpora enthalten', () => {
    // Der Korpus ist der TEST der Stufe 2. Wer auf dem Test trainiert, misst
    // Auswendiglernen statt Verstehen — die Ratsche wäre ab dann bedeutungslos.
    //
    // Bis hierher prüfte die Regel NUR den 243er-Bestandskorpus, obwohl es
    // seit Welle 1 fünf gibt: Eine Paraphrase, die eine Welle-1-Musterzeile
    // wortgleich abschreibt, wäre unbemerkt durchgegangen — und genau das ist
    // beim Nachschärfen dieser Familie beinahe passiert. Dieselbe Klasse
    // Fehler wie die Katalog-Fixture, die die neuen Datenkanäle nicht füllte:
    // Eine Regel gilt für das, was sie liest, nicht für das, was sie meint.
    const alleKorpora = [
      ...EVAL_KORPUS.map((z) => z.frage),
      ...WELLE1_KORPUS.map((z) => z.frage),
      ...WELLE2_KORPUS.map((z) => z.frage),
      ...WELLE3_KORPUS.map((z) => z.frage),
      ...WELLE5_KORPUS.map((z) => z.frage),
    ];
    const verboten = new Set(alleKorpora.map((f) => f.toLowerCase().replace(/[^a-zäöüß0-9]+/g, ' ').trim()));
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
