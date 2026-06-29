import { describe, it, expect } from 'vitest';
import { evaluateAffordability } from '../affordability';
import type { ForecastAccount, ForecastConfig, ForecastInput, RecurringFlow } from '../../forecast-types';

/**
 * „Frag dein Geld": Inverse Monte-Carlo. Aus der Vorwärts-Engine wird per Suche
 * ein Trade-off-Menü – kann ich mir X leisten, und wenn nicht, wie am ehesten?
 */

const START = '2026-01-01';
// Schlank halten: die inverse Suche macht viele MC-Läufe; 80 Trials reichen für
// die klar getrennten Testfälle und halten die Laufzeit im Rahmen.
const MC = { trials: 80, seed: 1 };

function checking(openingBalance: number): ForecastAccount {
  return { id: 'giro', name: 'Giro', kind: 'checking', openingBalance };
}

const salary: RecurringFlow = { id: 'salary', name: 'Gehalt', amount: 2000, cadence: 'monthly', anchorDate: START, accountId: 'giro' };
const rent: RecurringFlow = { id: 'rent', name: 'Miete', amount: -1000, cadence: 'monthly', anchorDate: START, accountId: 'giro' };

function input(opening: number, variableMonthly: number): ForecastInput {
  return {
    accounts: [checking(opening)],
    recurringFlows: [salary, rent],
    variableExpenses: [{ category: 'Shopping', monthlyAmount: variableMonthly, volatility: 0.25 }],
  };
}

const config: ForecastConfig = { startDate: START, safetyBuffer: 1200 };

describe('evaluateAffordability', () => {
  describe('Normal Behavior', () => {
    it('gesund + günstig → ohne Änderung leistbar (kein Menü)', () => {
      const r = evaluateAffordability(
        input(10000, 400),
        { startDate: START, safetyBuffer: 1000 },
        { amount: 300, dayIndex: 30 },
        { monteCarlo: MC },
      );
      expect(r.affordableAsIs).toBe(true);
      expect(r.options).toHaveLength(1);
      expect(r.options[0].lever).toBe('asis');
      expect(r.options[0].meetsTarget).toBe(true);
      expect(r.baseSuccess).toBeGreaterThanOrEqual(0.9);
    });

    it('knapp + teuer → Menü mit Sparen UND Mehr-verdienen', () => {
      const r = evaluateAffordability(input(2500, 600), config, { amount: 2500, dayIndex: 45 }, { monteCarlo: MC });

      expect(r.affordableAsIs).toBe(false);
      expect(r.baseSuccess).toBeLessThan(0.9);
      expect(r.options[0].lever).toBe('asis');

      const cut = r.options.find((o) => o.lever === 'cut');
      const earn = r.options.find((o) => o.lever === 'earn');
      expect(cut).toBeDefined();
      expect(earn).toBeDefined();
      expect(cut!.detail).toMatchObject({ kind: 'cut' });
      expect(earn!.detail).toMatchObject({ kind: 'earn' });
      if (cut!.detail.kind === 'cut') expect(cut!.detail.perMonth).toBeGreaterThan(0);
      if (earn!.detail.kind === 'earn') expect(earn!.detail.perMonth).toBeGreaterThan(0);

      // Jede vorgeschlagene Option erreicht wirklich die Zielsicherheit.
      for (const o of r.options.slice(1)) {
        expect(o.meetsTarget).toBe(true);
        expect(o.successProbability).toBeGreaterThanOrEqual(0.9);
      }
    }, 20000);

    it('alle Wahrscheinlichkeiten liegen in [0,1]', () => {
      const r = evaluateAffordability(input(2500, 600), config, { amount: 2500, dayIndex: 45 }, { monteCarlo: MC });
      for (const o of r.options) {
        expect(o.successProbability).toBeGreaterThanOrEqual(0);
        expect(o.successProbability).toBeLessThanOrEqual(1);
      }
    }, 20000);
  });

  describe('Edge Cases', () => {
    it('ohne Zahlungskonto → keine Aussage', () => {
      const r = evaluateAffordability(
        { accounts: [] },
        { startDate: START },
        { amount: 100, dayIndex: 10 },
        { monteCarlo: MC },
      );
      expect(r.options).toEqual([]);
      expect(r.affordableAsIs).toBe(false);
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] ist mit festem Seed reproduzierbar', () => {
      const goal = { amount: 2500, dayIndex: 45 };
      const a = evaluateAffordability(input(2500, 600), config, goal, { monteCarlo: MC });
      const b = evaluateAffordability(input(2500, 600), config, goal, { monteCarlo: MC });
      expect(a).toEqual(b);
    }, 30000);
  });
});
