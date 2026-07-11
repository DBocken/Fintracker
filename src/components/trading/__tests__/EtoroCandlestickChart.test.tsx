import { describe, it, expect, beforeAll } from 'vitest';
import { renderWithI18n } from '@/test-utils/render';
import type { CandlePoint } from '@/services/etoro-discover';
import EtoroCandlestickChart, { computeCandleGeometry } from '../EtoroCandlestickChart';

// Recharts' ResponsiveContainer braucht ResizeObserver, den jsdom nicht kennt.
beforeAll(() => {
  globalThis.ResizeObserver ||= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const candles: CandlePoint[] = [
  { date: '2026-01-01T00:00:00Z', open: 100, high: 105, low: 98, close: 102, isUp: true },
  { date: '2026-01-02T00:00:00Z', open: 102, high: 104, low: 95, close: 96, isUp: false },
];

describe('computeCandleGeometry', () => {
  describe('Normal Behavior', () => {
    it('sollte Docht über die volle Pixel-Box (high→low) spannen', () => {
      const geometry = computeCandleGeometry({
        x: 0,
        y: 10,
        width: 20,
        height: 100,
        payload: candles[0],
      });
      expect(geometry.wickY1).toBe(10);
      expect(geometry.wickY2).toBe(110);
    });

    it('sollte den Körper zwischen open und close innerhalb der Box positionieren', () => {
      // range = high(105) - low(98) = 7; close=102 (Körper-Oberkante) → (105-102)/7*70 = 30
      const geometry = computeCandleGeometry({ x: 0, y: 0, width: 20, height: 70, payload: candles[0] });
      expect(geometry.bodyTop).toBeCloseTo(30);
      expect(geometry.bodyHeight).toBeCloseTo(20); // |close-open|/range*height = 2/7*70 = 20
    });

    it('sollte grüne Farbe (positive) für isUp und rote (warning) für Abwärtskerzen wählen', () => {
      expect(computeCandleGeometry({ x: 0, y: 0, width: 10, height: 10, payload: candles[0] }).color).toContain('--positive');
      expect(computeCandleGeometry({ x: 0, y: 0, width: 10, height: 10, payload: candles[1] }).color).toContain('--warning');
    });
  });

  describe('Edge Cases', () => {
    it('sollte bei high === low (range=0) nicht durch 0 teilen', () => {
      const flat: CandlePoint = { date: '2026-01-01', open: 100, high: 100, low: 100, close: 100, isUp: true };
      const geometry = computeCandleGeometry({ x: 0, y: 0, width: 10, height: 50, payload: flat });
      expect(Number.isFinite(geometry.bodyTop)).toBe(true);
      expect(Number.isFinite(geometry.bodyHeight)).toBe(true);
    });

    it('sollte eine Mindesthöhe von 1px für den Körper garantieren (Doji-Kerzen)', () => {
      const doji: CandlePoint = { date: '2026-01-01', open: 100, high: 105, low: 95, close: 100, isUp: true };
      const geometry = computeCandleGeometry({ x: 0, y: 0, width: 10, height: 50, payload: doji });
      expect(geometry.bodyHeight).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('EtoroCandlestickChart', () => {
  it('sollte ohne Absturz rendern (auch mit leeren candles)', () => {
    const { container: withData } = renderWithI18n(<EtoroCandlestickChart candles={candles} />);
    expect(withData.querySelector('.recharts-responsive-container')).toBeInTheDocument();

    const { container: empty } = renderWithI18n(<EtoroCandlestickChart candles={[]} />);
    expect(empty.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });
});
