import { describe, it, expect } from 'vitest';
import {
  resolveLoadingPhase,
  remainingSkeletonMs,
  SKELETON_DELAY_MS,
  SKELETON_MIN_VISIBLE_MS,
} from '../loading-choreography';

/**
 * WP-7.3 — Ladeverhalten, der zeitliche Teil.
 *
 * Geprüft wird die Choreografie, nicht die Optik: Ein Skeleton, das 40 ms
 * lang aufblitzt, ist kein Ladezustand, sondern ein Zucken.
 */

describe('resolveLoadingPhase', () => {
  it('sollte bei kurzem Laden noch gar nichts zeigen', () => {
    // Schneller als ein Mensch einen Zustandswechsel erkennt.
    expect(
      resolveLoadingPhase({ loading: true, loadingForMs: 40, skeletonVisibleForMs: null }),
    ).toBe('blank');
  });

  it('sollte ab der Schwelle das Skeleton zeigen', () => {
    expect(
      resolveLoadingPhase({
        loading: true,
        loadingForMs: SKELETON_DELAY_MS,
        skeletonVisibleForMs: null,
      }),
    ).toBe('skeleton');
  });

  it('sollte bei sehr schnellem Laden direkt den Inhalt zeigen', () => {
    // Der Kern des Arbeitspakets: kein Skeleton, das niemand lesen konnte.
    expect(
      resolveLoadingPhase({ loading: false, loadingForMs: null, skeletonVisibleForMs: null }),
    ).toBe('content');
  });

  it('sollte ein gerade erst erschienenes Skeleton stehen lassen', () => {
    // Daten treffen 20 ms nach dem Skeleton ein. Wechselte es sofort, entstünde
    // dasselbe Zucken am anderen Ende.
    expect(
      resolveLoadingPhase({ loading: false, loadingForMs: null, skeletonVisibleForMs: 20 }),
    ).toBe('skeleton');
  });

  it('sollte nach der Mindestdauer auf den Inhalt wechseln', () => {
    expect(
      resolveLoadingPhase({
        loading: false,
        loadingForMs: null,
        skeletonVisibleForMs: SKELETON_MIN_VISIBLE_MS,
      }),
    ).toBe('content');
  });

  it('sollte ein sichtbares Skeleton nicht zurück auf leer fallen lassen', () => {
    // Gegenprobe: einmal gezeigt, bleibt es — auch wenn `loadingForMs`
    // zurückgesetzt würde. Sonst flackerte es zwischen leer und Skeleton.
    expect(
      resolveLoadingPhase({ loading: true, loadingForMs: 10, skeletonVisibleForMs: 5 }),
    ).toBe('skeleton');
  });

  it('sollte die Mindestdauer über der Verzögerung halten', () => {
    // Sonst könnte ein Skeleton kürzer stehen, als es zum Erscheinen brauchte.
    expect(SKELETON_MIN_VISIBLE_MS).toBeGreaterThan(SKELETON_DELAY_MS);
  });
});

describe('remainingSkeletonMs', () => {
  it('sollte die Restdauer bis zum erlaubten Wechsel liefern', () => {
    expect(remainingSkeletonMs(100)).toBe(SKELETON_MIN_VISIBLE_MS - 100);
  });

  it('sollte 0 liefern, wenn nie ein Skeleton stand', () => {
    expect(remainingSkeletonMs(null)).toBe(0);
  });

  it('[REGRESSION] sollte nie negativ werden', () => {
    // Ein negativer Wert landete als `setTimeout(-x)` in der Aufrufstelle und
    // liefe dort sofort — harmlos, aber die Rechnung wäre falsch.
    expect(remainingSkeletonMs(SKELETON_MIN_VISIBLE_MS + 5000)).toBe(0);
  });
});
