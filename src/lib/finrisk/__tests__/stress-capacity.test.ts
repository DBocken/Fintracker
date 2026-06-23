import { describe, it, expect } from 'vitest';
import { calculateStressCapacity } from '../stress-capacity';

/**
 * Baut `count` Pfade über `days` Tage. Pfad i fällt linear auf `endValues[i]`.
 * So lässt sich die Headroom-Verteilung gezielt steuern.
 */
function pathsWithMinima(minima: number[], days = 30): number[][] {
  return minima.map((min) => {
    const path = new Array<number>(days);
    for (let t = 0; t < days; t++) {
      // Startet hoch, fällt zum letzten Tag auf das Minimum.
      path[t] = 1000 - ((1000 - min) * t) / (days - 1);
    }
    return path;
  });
}

describe('calculateStressCapacity', () => {
  describe('Normal Behavior', () => {
    it('sollte bei höherem Sicherheitsniveau einen kleineren tragbaren Schock liefern', () => {
      // Minima von 100..1000 -> Headrooms (threshold 0) entsprechend.
      const minima = Array.from({ length: 100 }, (_, i) => 100 + i * 9);
      const paths = pathsWithMinima(minima);
      const cap = calculateStressCapacity(paths, 0, [0.8, 0.9, 0.95]);
      expect(cap[0].maxAffordableShock).toBeGreaterThanOrEqual(cap[1].maxAffordableShock);
      expect(cap[1].maxAffordableShock).toBeGreaterThanOrEqual(cap[2].maxAffordableShock);
    });

    it('sollte den Schwellenabstand berücksichtigen (Headroom = min − threshold)', () => {
      const minima = Array.from({ length: 100 }, (_, i) => 500 + i);
      const paths = pathsWithMinima(minima);
      const noBuffer = calculateStressCapacity(paths, 0, [0.9]);
      const withBuffer = calculateStressCapacity(paths, 300, [0.9]);
      // Höherer Puffer reduziert den verbleibenden Headroom -> kleinerer Schock.
      expect(withBuffer[0].maxAffordableShock).toBeLessThan(noBuffer[0].maxAffordableShock);
    });

    it('sollte immer eine Interpretation mit Sicherheitsniveau liefern (nie absolut)', () => {
      const paths = pathsWithMinima([200, 400, 600]);
      const cap = calculateStressCapacity(paths, 0, [0.9]);
      expect(cap[0].interpretation).toContain('90 %');
      expect(cap[0].interpretation).not.toContain('maximal');
    });
  });

  describe('Edge Cases', () => {
    it('sollte nie einen negativen tragbaren Schock liefern', () => {
      // Pfade brechen den Puffer bereits -> Headroom negativ -> Schock auf 0 geklemmt.
      const paths = pathsWithMinima([-500, -300, -100]);
      const cap = calculateStressCapacity(paths, 0, [0.8, 0.9, 0.95]);
      for (const level of cap) expect(level.maxAffordableShock).toBeGreaterThanOrEqual(0);
    });

    it('sollte mit leeren Pfaden robust 0 liefern', () => {
      const cap = calculateStressCapacity([], 1000, [0.9]);
      expect(cap[0].maxAffordableShock).toBe(0);
      expect(cap[0].criticalDay).toBe(0);
    });
  });
});
