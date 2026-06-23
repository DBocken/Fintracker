import { describe, it, expect } from 'vitest';
import { calculateBreachProbabilities } from '../breach';

describe('calculateBreachProbabilities', () => {
  describe('Normal Behavior', () => {
    it('sollte den Anteil der Pfade unter der Schwelle je Tag liefern', () => {
      // 4 Pfade, 2 Tage. Tag 0: alle 100. Tag 1: 0, 100, 200, 300.
      const paths = [
        [100, 0],
        [100, 100],
        [100, 200],
        [100, 300],
      ];
      const result = calculateBreachProbabilities(paths, [150]);
      // Tag 0: alle 100 < 150 -> 4/4 = 1. Tag 1: 0 und 100 < 150 -> 2/4 = 0.5.
      expect(result['150']).toEqual([1, 0.5]);
    });

    it('sollte für eine höhere Schwelle eine >= hohe Bruchwahrscheinlichkeit liefern', () => {
      const paths = [
        [100, 50],
        [200, 150],
        [300, 250],
      ];
      const result = calculateBreachProbabilities(paths, [100, 300]);
      result['100'].forEach((low, t) => {
        expect(result['300'][t]).toBeGreaterThanOrEqual(low);
      });
    });
  });

  describe('Edge Cases', () => {
    it('sollte alle Werte in [0, 1] halten', () => {
      const paths = [
        [10, -5],
        [20, 5],
      ];
      const result = calculateBreachProbabilities(paths, [0, 15, 100]);
      for (const series of Object.values(result)) {
        for (const p of series) {
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThanOrEqual(1);
        }
      }
    });

    it('sollte mit leeren Pfaden robust sein', () => {
      const result = calculateBreachProbabilities([], [100]);
      expect(result['100']).toEqual([]);
    });
  });
});
