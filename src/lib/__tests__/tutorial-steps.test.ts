import { describe, it, expect } from 'vitest';
import {
  TUTORIAL_STEPS,
  stepsFor,
  hasSteps,
  stepTitleKey,
  stepBodyKey,
  anchorSelector,
} from '../tutorial-steps';
import { TUTORIAL_ORDER, type TutorialChapterId } from '../tutorial-sequence';
import { translations, SUPPORTED_LOCALES } from '@/i18n/translations';

function resolve(locale: string, key: string): unknown {
  let node: unknown = (translations as Record<string, unknown>)[locale];
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

describe('TUTORIAL_STEPS', () => {
  it('sollte nur Kapitel führen, die es im Lehrplan gibt', () => {
    const known = TUTORIAL_ORDER.map((c) => c.id);
    for (const chapter of Object.keys(TUTORIAL_STEPS)) {
      expect(known).toContain(chapter as TutorialChapterId);
    }
  });

  it('sollte je Kapitel eindeutige Schritt-IDs haben', () => {
    for (const [chapter, steps] of Object.entries(TUTORIAL_STEPS)) {
      const ids = (steps ?? []).map((s) => s.id);
      expect(new Set(ids).size, `Kapitel ${chapter}`).toBe(ids.length);
    }
  });

  it('sollte höchstens elf Schritte je Kapitel führen', () => {
    // Ein Kapitel ist ein Arbeitsschritt, kein Bildschirm — die Buchungsseite
    // hat allein 30 erklärbare Bedienelemente und zerfällt deshalb in vier
    // Kapitel (`docs/tutorial-script-transactions.md`). Die Grenze bleibt,
    // damit niemand daraus wieder eine Vorlesung macht.
    for (const [chapter, steps] of Object.entries(TUTORIAL_STEPS)) {
      expect((steps ?? []).length, `Kapitel ${chapter}`).toBeLessThanOrEqual(11);
    }
  });

  it('sollte für jeden öffnenden Schritt auch den Anker kennen, den er klickt', () => {
    // `openAnchor` zeigt auf ein Element, das die Führung selbst anklickt.
    // Zeigt es ins Leere, bliebe der Schritt ohne den Bereich, von dem er
    // spricht — und niemand merkte es.
    const known = new Set(
      Object.values(TUTORIAL_STEPS)
        .flatMap((steps) => steps ?? [])
        .flatMap((s) => (s.anchor ? [s.anchor] : [])),
    );
    for (const [chapter, steps] of Object.entries(TUTORIAL_STEPS)) {
      for (const step of steps ?? []) {
        if (step.openAnchor) {
          expect(known, `${chapter}.${step.id}`).toContain(step.openAnchor);
        }
      }
    }
  });

  it('sollte für ein Kapitel ohne Schritte leer liefern statt zu werfen', () => {
    // `source` ist der dauerhafte Fall: Kapitel 0 IST der DataSourceDialog,
    // ein Overlay darüber wäre eine Führung durch eine Führung. Bewusst nicht
    // an einem noch untexteten Kapitel festgemacht — das wäre ein Test auf
    // einen Zwischenstand statt auf eine Zusicherung.
    expect(stepsFor('source')).toEqual([]);
    expect(hasSteps('source')).toBe(false);
    expect(hasSteps('dashboard')).toBe(true);
  });
});

describe('Schlüssel der Schritttexte', () => {
  it('sollte Schlüssel mechanisch aus den IDs bilden', () => {
    const [first] = stepsFor('dashboard');
    expect(stepTitleKey('dashboard', first)).toBe('tutorial.dashboard.flow.title');
    expect(stepBodyKey('dashboard', first)).toBe('tutorial.dashboard.flow.body');
  });

  it('[REGRESSION] sollte jeden Schritttext in ALLEN Sprachen auflösen können', () => {
    // `t()` gibt bei unbekanntem Schlüssel den Schlüssel selbst zurück — ein
    // fehlender Text stünde also wörtlich als „tutorial.city.arrival.title"
    // im Popup, ohne dass irgendetwas rot wird.
    const missing: string[] = [];
    for (const [chapter, steps] of Object.entries(TUTORIAL_STEPS)) {
      for (const step of steps ?? []) {
        for (const locale of SUPPORTED_LOCALES) {
          for (const key of [
            stepTitleKey(chapter as TutorialChapterId, step),
            stepBodyKey(chapter as TutorialChapterId, step),
          ]) {
            if (typeof resolve(locale, key) !== 'string') missing.push(`${locale}: ${key}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('anchorSelector', () => {
  it('sollte den Anker über das Marker-Attribut adressieren, nie über Text', () => {
    expect(anchorSelector('dashboard-flow')).toBe('[data-tour-id="dashboard-flow"]');
  });
});
