import { describe, expect, it } from 'vitest';
import {
  PERFORMANCE_PREVIEW_DAYS,
  buildPerformancePreview,
} from '../performance-preview';

/**
 * Der simulierte Depot-Verlauf. Lag als `generatePerformanceData()` in
 * `TradingDashboard.tsx` und war dort nicht prüfbar — weder auf Stabilität
 * noch darauf, dass Diagramm und zugängliche Tabelle dasselbe zeigen.
 */
describe('buildPerformancePreview', () => {
  it('sollte ohne Kennzahlen nichts liefern', () => {
    expect(buildPerformancePreview(null)).toEqual([]);
    expect(buildPerformancePreview(undefined)).toEqual([]);
  });

  it('sollte einen Punkt je Tag plus den Startpunkt liefern', () => {
    const points = buildPerformancePreview({ totalCost: 1000, totalValue: 1200 });
    expect(points).toHaveLength(PERFORMANCE_PREVIEW_DAYS + 1);
    expect(points[0].day).toBeNull();
    expect(points.at(-1)!.day).toBe(PERFORMANCE_PREVIEW_DAYS);
  });

  it('sollte exakt beim Einstandswert beginnen und beim aktuellen Wert enden', () => {
    // Sonst endet die Kurve neben den Kennzahlen, die dieselbe Zahl zeigen.
    const points = buildPerformancePreview({ totalCost: 1000, totalValue: 1200 });
    expect(points[0].value).toBe(1000);
    expect(points.at(-1)!.value).toBe(1200);
  });

  it('sollte auch bei Verlust monoton fallen', () => {
    const points = buildPerformancePreview({ totalCost: 1200, totalValue: 900 }, 4);
    expect(points.map((p) => p.value)).toEqual([1200, 1125, 1050, 975, 900]);
  });

  it('sollte bei unverändertem Wert eine flache Linie liefern', () => {
    const points = buildPerformancePreview({ totalCost: 500, totalValue: 500 }, 3);
    expect(points.every((p) => p.value === 500)).toBe(true);
  });

  it('[REGRESSION] sollte bei zwei Aufrufen dieselbe Reihe liefern', () => {
    // Die frühere Fassung benutzte `Math.random()` und wurde im selben Render
    // ZWEIMAL aufgerufen: einmal für die zugängliche Tabelle (`ChartFigure
    // rows`), einmal für das Diagramm (`LineChart data`). Beide bekamen andere
    // Zahlen — die nicht-visuelle Entsprechung widersprach dem Bild, das sie
    // ersetzen sollte.
    const summary = { totalCost: 1000, totalValue: 1200 };
    expect(buildPerformancePreview(summary)).toEqual(buildPerformancePreview(summary));
  });

  it('[REGRESSION] sollte über wiederholte Aufrufe stabil bleiben', () => {
    // Und sie würfelte bei jedem Re-Render neu: der „Verlauf" zappelte, sobald
    // irgendetwas anderes auf der Seite sich änderte.
    const summary = { totalCost: 2500, totalValue: 2300 };
    const erste = buildPerformancePreview(summary);
    for (let i = 0; i < 5; i++) {
      expect(buildPerformancePreview(summary)).toEqual(erste);
    }
  });

  it('sollte einen unsinnigen Tagesbereich nicht durchrechnen', () => {
    expect(buildPerformancePreview({ totalCost: 100, totalValue: 200 }, 0)).toEqual([
      { day: null, value: 100 },
    ]);
  });
});
