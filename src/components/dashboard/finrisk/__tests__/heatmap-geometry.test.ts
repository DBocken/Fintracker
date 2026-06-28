import { describe, it, expect } from 'vitest';
import { resolveHeatmapCell, isTap, HEATMAP_PAD } from '../heatmap-geometry';

/**
 * Geometrie & Tap-Erkennung der Heatmap. Diese Logik ersetzt die frühere
 * Abhängigkeit vom `click`-Event – auf Touch öffnet jetzt ein Tap (Pointerup
 * mit geringer Bewegung) die Zell-Details, ein Wisch/Scrub dagegen nicht.
 */

const DIMS = { width: 658, height: 300, nDays: 90, bins: 48 };

describe('resolveHeatmapCell', () => {
  describe('Normal Behavior', () => {
    it('sollte einen Punkt links oben auf Tag 0 und den obersten Bin abbilden', () => {
      const cell = resolveHeatmapCell(HEATMAP_PAD.left + 1, HEATMAP_PAD.top + 1, DIMS);
      expect(cell).toEqual({ day: 0, bin: DIMS.bins - 1 });
    });

    it('sollte einen Punkt rechts unten auf den letzten Tag und Bin 0 abbilden', () => {
      const cell = resolveHeatmapCell(
        DIMS.width - HEATMAP_PAD.right - 1,
        DIMS.height - HEATMAP_PAD.bottom - 1,
        DIMS,
      );
      expect(cell).toEqual({ day: DIMS.nDays - 1, bin: 0 });
    });

    it('sollte die Mitte ungefähr in der Mitte von Tagen und Bins abbilden', () => {
      const cell = resolveHeatmapCell(DIMS.width / 2, DIMS.height / 2, DIMS)!;
      expect(cell.day).toBeGreaterThan(DIMS.nDays * 0.3);
      expect(cell.day).toBeLessThan(DIMS.nDays * 0.7);
      expect(cell.bin).toBeGreaterThan(DIMS.bins * 0.3);
      expect(cell.bin).toBeLessThan(DIMS.bins * 0.7);
    });
  });

  describe('Edge Cases', () => {
    it('sollte außerhalb des Plot-Bereichs (Achsenränder) null liefern', () => {
      expect(resolveHeatmapCell(HEATMAP_PAD.left - 2, 100, DIMS)).toBeNull(); // linke Achse
      expect(resolveHeatmapCell(300, HEATMAP_PAD.top - 2, DIMS)).toBeNull(); // über dem Plot
      expect(resolveHeatmapCell(300, DIMS.height - HEATMAP_PAD.bottom + 2, DIMS)).toBeNull(); // X-Achse
      expect(resolveHeatmapCell(DIMS.width - HEATMAP_PAD.right + 2, 100, DIMS)).toBeNull(); // rechts
    });

    it('sollte bei ungemessener Fläche (Größe 0) null liefern', () => {
      expect(resolveHeatmapCell(40, 40, { width: 0, height: 0, nDays: 90, bins: 48 })).toBeNull();
    });

    it('sollte ohne Tage/Bins null liefern', () => {
      expect(resolveHeatmapCell(100, 100, { ...DIMS, nDays: 0 })).toBeNull();
      expect(resolveHeatmapCell(100, 100, { ...DIMS, bins: 0 })).toBeNull();
    });
  });
});

describe('isTap', () => {
  it('sollte eine geringe Bewegung als Tap werten', () => {
    expect(isTap({ x: 100, y: 100 }, { x: 104, y: 103 })).toBe(true);
  });

  it('sollte eine deutliche Bewegung (Wisch/Scrub) nicht als Tap werten', () => {
    expect(isTap({ x: 100, y: 100 }, { x: 160, y: 105 })).toBe(false);
  });

  it('sollte ohne Startpunkt false liefern', () => {
    expect(isTap(null, { x: 100, y: 100 })).toBe(false);
    expect(isTap(undefined, { x: 100, y: 100 })).toBe(false);
  });

  it('sollte exakt an der Schwelle noch als Tap gelten', () => {
    expect(isTap({ x: 0, y: 0 }, { x: 12, y: 0 }, 12)).toBe(true);
    expect(isTap({ x: 0, y: 0 }, { x: 13, y: 0 }, 12)).toBe(false);
  });
});
