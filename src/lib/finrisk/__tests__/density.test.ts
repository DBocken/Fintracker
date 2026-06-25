import { describe, it, expect } from 'vitest';
import { buildDensityField, columnModes } from '../density';
import { regionForValue, densityColor } from '../density-color';

/** Erzeugt n identische Pfade mit konstantem Wert pro Tag. */
function constPaths(n: number, days: number, value: number): number[][] {
  return Array.from({ length: n }, () => new Array<number>(days).fill(value));
}

describe('buildDensityField', () => {
  describe('Normal Behavior', () => {
    it('sollte jede Tagesspalte vollständig auf die Pfade aufsummieren (kein Pfad geht verloren)', () => {
      const paths = [
        [100, 100, 100],
        [200, 200, 200],
        [300, 300, 300],
      ];
      const field = buildDensityField(paths, ['d1', 'd2', 'd3'], { bins: 16 });
      expect(field.total).toBe(3);
      for (let t = 0; t < 3; t++) {
        const sum = field.counts[t].reduce((s, c) => s + c, 0);
        expect(sum).toBe(3);
      }
    });

    it('sollte das Wertefenster die eingeschlossenen Schwellen (0, Puffer) enthalten', () => {
      const paths = constPaths(50, 2, 1000);
      const field = buildDensityField(paths, ['d1', 'd2'], { include: [0, 1500] });
      expect(field.valueMin).toBeLessThanOrEqual(0);
      expect(field.valueMax).toBeGreaterThanOrEqual(1500);
    });

    it('sollte columnMax der häufigsten Bin-Besetzung je Tag entsprechen', () => {
      // 8 Pfade alle gleich -> ein Bin trägt alle 8.
      const field = buildDensityField(constPaths(8, 1, 500), ['d1'], { bins: 10 });
      expect(field.columnMax[0]).toBe(8);
    });
  });

  describe('Multimodalität', () => {
    it('sollte eine bimodale Spalte als zwei getrennte Dichte-Rücken abbilden', () => {
      // Hälfte tief (Szenario), Hälfte hoch (Basis) – klar getrennt.
      const low = constPaths(50, 1, -500);
      const high = constPaths(50, 1, 4000);
      const field = buildDensityField([...low, ...high], ['d1'], { bins: 24 });

      const occupied = field.counts[0]
        .map((c, b) => ({ c, b }))
        .filter((x) => x.c > 0);
      // Genau zwei besetzte Bins, an entgegengesetzten Enden.
      expect(occupied.length).toBe(2);
      expect(occupied[0].c).toBe(50);
      expect(occupied[1].c).toBe(50);
      expect(occupied[1].b - occupied[0].b).toBeGreaterThan(1);

      const modes = columnModes(field, 0);
      expect(modes.length).toBe(2);
      // Eine Mode im Defizit, eine im gesunden Bereich.
      expect(modes.some((m) => m.value < 0)).toBe(true);
      expect(modes.some((m) => m.value > 1000)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('sollte Out-of-range-Ausreißer in den Randbin clampen statt zu verlieren', () => {
      // 99 Pfade eng, 1 extremer Ausreißer -> robustes Fenster klammert ihn aus,
      // er landet aber im obersten Bin; Spaltensumme bleibt 100.
      const tight = constPaths(99, 1, 100);
      const outlier = [[1_000_000]];
      const field = buildDensityField([...tight, ...outlier], ['d1'], { bins: 20, clipPercent: 2 });
      const sum = field.counts[0].reduce((s, c) => s + c, 0);
      expect(sum).toBe(100);
      // Oberster Bin trägt den Ausreißer.
      expect(field.counts[0][field.bins - 1]).toBeGreaterThanOrEqual(1);
    });

    it('sollte mit konstanten Werten (degenerierte Spanne) ein gültiges Fenster liefern', () => {
      const field = buildDensityField(constPaths(10, 2, 0), ['d1', 'd2']);
      expect(field.valueMax).toBeGreaterThan(field.valueMin);
      expect(Number.isFinite(field.binSize)).toBe(true);
      expect(field.binSize).toBeGreaterThan(0);
    });

    it('sollte bei leeren Pfaden ein formgleiches Nullfeld liefern', () => {
      const field = buildDensityField([], ['d1', 'd2'], { bins: 12 });
      expect(field.total).toBe(0);
      expect(field.counts).toHaveLength(2);
      expect(field.counts[0]).toHaveLength(12);
      expect(field.columnMax).toEqual([0, 0]);
    });

    it('sollte bei leerer Tagesachse nicht abstürzen', () => {
      const field = buildDensityField([[/* keine Tage */]], []);
      expect(field.counts).toHaveLength(0);
      expect(field.dates).toHaveLength(0);
    });
  });
});

describe('regionForValue', () => {
  it('sollte negative Werte als Defizit einstufen', () => {
    expect(regionForValue(-1, 500)).toBe('deficit');
  });
  it('sollte Werte zwischen 0 und Puffer als Risiko einstufen', () => {
    expect(regionForValue(200, 500)).toBe('caution');
  });
  it('sollte Werte über dem Puffer als gesund einstufen', () => {
    expect(regionForValue(800, 500)).toBe('healthy');
  });
  it('sollte ohne Puffer (0) alles ab 0 als gesund einstufen', () => {
    expect(regionForValue(0, 0)).toBe('healthy');
    expect(regionForValue(10, 0)).toBe('healthy');
  });
});

describe('densityColor', () => {
  it('sollte mit steigender Dichte eine kräftigere (weniger transparente) Farbe liefern', () => {
    const faint = densityColor('healthy', 0.05);
    const strong = densityColor('healthy', 1);
    const alpha = (s: string) => Number(s.slice(s.lastIndexOf(',') + 1, -1));
    expect(alpha(strong)).toBeGreaterThan(alpha(faint));
  });
  it('sollte Intensitäten außerhalb [0,1] robust clampen', () => {
    expect(() => densityColor('deficit', -5)).not.toThrow();
    expect(() => densityColor('caution', 99)).not.toThrow();
    expect(densityColor('deficit', 5)).toBe(densityColor('deficit', 1));
  });
});
