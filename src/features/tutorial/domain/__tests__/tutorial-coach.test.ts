import { describe, it, expect } from 'vitest';
import {
  buildTutorialRecommendation,
  nextTeachableChapter,
  TUTORIAL_RECOMMENDATION_ID,
} from '../tutorial-coach';
import type { Curriculum } from '../tutorial-sequence';

/**
 * Die Brücke vom Lehrplan zum Coach: Ein vertagtes Kapitel wird dort zur
 * Karte, sobald seine Voraussetzung eingetreten ist — und vorher nicht.
 */

function curriculum(next: Curriculum['next'], postponed: Curriculum['postponed'] = []): Curriculum {
  return { next, postponed };
}

describe('nextTeachableChapter', () => {
  it('sollte das erste Kapitel mit Text liefern', () => {
    expect(nextTeachableChapter(curriculum(['transactions', 'dashboard']))).toBe('transactions');
  });

  it('sollte Kapitel ohne Text überspringen statt anzuhalten', () => {
    // `source` hat bewusst keine Schritte — der Dialog IST das Kapitel.
    expect(nextTeachableChapter(curriculum(['source', 'dashboard']))).toBe('dashboard');
  });

  it('sollte nichts liefern, wenn nichts ansteht', () => {
    expect(nextTeachableChapter(curriculum([]))).toBeNull();
    expect(nextTeachableChapter(null)).toBeNull();
  });

  it('sollte vertagte Kapitel nicht anbieten', () => {
    // Vertagt heißt: Voraussetzung noch nicht erfüllt. Eine Karte dafür wäre
    // eine Führung ins Leere.
    expect(nextTeachableChapter(curriculum([], ['budgets', 'liquidity']))).toBeNull();
  });
});

describe('buildTutorialRecommendation', () => {
  it('sollte für ein anstehendes Kapitel eine Karte bauen', () => {
    const rec = buildTutorialRecommendation('budgets');
    expect(rec?.id).toBe(TUTORIAL_RECOMMENDATION_ID);
    expect(rec?.severity).toBe('info');
    expect(rec?.ctaTo).toBe('/budgets');
  });

  it('sollte den Bereichsnamen einsetzen statt ihn abzuschreiben', () => {
    // Der Name kommt aus dem Navigations-Schlüssel — eine Umbenennung schlägt
    // dadurch automatisch durch, statt hier zu veralten.
    const rec = buildTutorialRecommendation('budgets');
    expect(rec?.message).not.toContain('{chapter}');
    expect(rec?.message?.length ?? 0).toBeGreaterThan(0);
  });

  it('sollte für ein Kernkapitel auf den Coach selbst führen', () => {
    // Kernkapitel haben keinen wählbaren Bereich und damit keinen Pfad im
    // Feature-Katalog; die Führung startet dann vom Coach aus.
    expect(buildTutorialRecommendation('transactions')?.ctaTo).toBe('/coach');
  });

  it('sollte schweigen, wenn nichts ansteht', () => {
    expect(buildTutorialRecommendation(null)).toBeNull();
  });

  it('sollte für ein Kapitel ohne Text keine Karte bauen', () => {
    expect(buildTutorialRecommendation('source')).toBeNull();
  });
});
