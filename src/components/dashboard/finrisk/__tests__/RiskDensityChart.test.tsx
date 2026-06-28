import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RiskDensityChart from '../RiskDensityChart';
import { buildDensityField } from '@/lib/finrisk/density';
import type { ScenarioResult } from '@/lib/finrisk/scenario-payload-types';

/** Baut ein minimales, aber vollständiges ScenarioResult für den Render-Test. */
function makeResult(paths: number[][], dates: string[], withDetails = false): ScenarioResult {
  const density = buildDensityField(paths, dates, { bins: 16, include: [0, 1000] });
  const daily = dates.map((date, d) => {
    const col = paths.map((p) => p[d]).sort((a, b) => a - b);
    const at = (q: number) => col[Math.min(col.length - 1, Math.floor(q * (col.length - 1)))];
    return { date, p10: at(0.1), p50: at(0.5), p90: at(0.9) };
  });
  return {
    scenarioId: 's1',
    scenarioType: 'base_check',
    baselineEndP50: 2000,
    scenarioEndP50: 1500,
    deltaEndP50: -500,
    breachProbabilities: { '0': dates.map(() => 0.1), '1000': dates.map(() => 0.3) },
    stressCapacity: [0.8, 0.9, 0.95].map((c) => ({
      confidenceLevel: c,
      thresholdAmount: 1000,
      maxAffordableShock: Math.round(2000 * (1 - c)),
      criticalDay: 1,
      interpretation: '…',
    })),
    diagnosis: 'Test-Diagnose.',
    warnings: [],
    daily,
    density,
    horizonDays: dates.length,
    ...(withDetails
      ? {
          assumptions: paths.map(() => ({
            variableByCategory: [
              { category: 'Lebensmittel', plannedMonthly: 400, monthly: { '2026-01': 400 } },
            ],
            income: [],
          })),
          representativeByCell: dates.map(() => new Array<number>(density.bins).fill(0)),
        }
      : {}),
  };
}

describe('RiskDensityChart', () => {
  const dates = ['2026-01-01', '2026-02-01', '2026-03-01'];
  // Bimodal: Hälfte tief, Hälfte hoch.
  const paths = [
    ...Array.from({ length: 10 }, () => [-500, -400, -300]),
    ...Array.from({ length: 10 }, () => [3000, 3200, 3400]),
  ];

  describe('Normal Behavior', () => {
    it('sollte die Heatmap mit Aria-Label und Legende rendern', () => {
      render(<RiskDensityChart result={makeResult(paths, dates)} safetyBuffer={1000} />);
      expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/Liquiditäts-Heatmap/);
      expect(screen.getByText('gesund')).toBeInTheDocument();
      expect(screen.getByText(/heller = wahrscheinlicher/)).toBeInTheDocument();
    });

    it('sollte ein Sicherheitsniveau auswählbar machen', () => {
      render(<RiskDensityChart result={makeResult(paths, dates)} safetyBuffer={1000} />);
      const btn95 = screen.getByRole('button', { name: '95 %' });
      fireEvent.click(btn95);
      expect(btn95).toHaveAttribute('aria-pressed', 'true');
      // Stress-Readout reagiert auf die Auswahl.
      expect(screen.getByText(/Sicherheit trägt deine Liquidität/)).toBeInTheDocument();
    });

    it('sollte Pointer-Interaktion ohne Absturz verarbeiten', () => {
      render(<RiskDensityChart result={makeResult(paths, dates)} safetyBuffer={1000} />);
      const stage = screen.getByRole('img');
      expect(() => {
        fireEvent.pointerMove(stage, { clientX: 120, clientY: 40 });
        fireEvent.pointerDown(stage, { clientX: 120, clientY: 40 });
        fireEvent.pointerLeave(stage);
      }).not.toThrow();
    });

    it('sollte die Zell-Klick-Möglichkeit ankündigen, wenn Annahmen vorliegen', () => {
      render(<RiskDensityChart result={makeResult(paths, dates, true)} safetyBuffer={1000} />);
      expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/Zelle antippen/);
    });

    it('sollte ohne Annahmen keine Klick-Ankündigung zeigen (reine Anzeige)', () => {
      render(<RiskDensityChart result={makeResult(paths, dates)} safetyBuffer={1000} />);
      expect(screen.getByRole('img').getAttribute('aria-label')).not.toMatch(/Zelle antippen/);
    });

    it('sollte ein Tippen (Pointerdown→up) ohne gültige Geometrie ohne Absturz verarbeiten', () => {
      render(<RiskDensityChart result={makeResult(paths, dates, true)} safetyBuffer={1000} />);
      const stage = screen.getByRole('img');
      expect(() => {
        fireEvent.pointerDown(stage, { clientX: 120, clientY: 80 });
        fireEvent.pointerUp(stage, { clientX: 121, clientY: 81 });
        fireEvent.pointerCancel(stage);
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('sollte bei leerem Dichtefeld einen Platzhalter zeigen', () => {
      const empty = makeResult([], []);
      render(<RiskDensityChart result={empty} safetyBuffer={1000} />);
      expect(screen.getByText(/Noch keine Pfade/)).toBeInTheDocument();
    });
  });
});
