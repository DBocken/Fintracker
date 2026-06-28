import { describe, it, expect } from 'vitest';
import { calculateDeterministicForecast } from '@/lib/forecast';
import type { ForecastAccount, ForecastConfig, ForecastInput, RecurringFlow } from '@/lib/forecast-types';

/**
 * „Gegensteuern bei Knappheit" (adaptiveSpending) – bewusstes Was-wäre-wenn:
 * droht der operative Saldo unter die Schwelle zu fallen, hält der Nutzer
 * diskretionäre Ausgaben zurück (Fixkosten bleiben). Opt-in, Baseline unverändert.
 */

const START = '2026-01-01';
const CONFIG: ForecastConfig = { startDate: START, months: 6, safetyBuffer: 1000 };

function checking(openingBalance: number): ForecastAccount {
  return { id: 'giro', name: 'Girokonto', kind: 'checking', openingBalance };
}

const salary: RecurringFlow = { id: 'salary', name: 'Gehalt', amount: 2000, cadence: 'monthly', anchorDate: START, accountId: 'giro' };
const rent: RecurringFlow = { id: 'rent', name: 'Miete', amount: -1000, cadence: 'monthly', anchorDate: START, accountId: 'giro' };

/** Ausgabenfreudig: 1500 €/Monat variabel -> ohne Gegensteuern sinkt der Saldo. */
function spendyInput(): ForecastInput {
  return {
    accounts: [checking(1200)],
    recurringFlows: [salary, rent],
    variableExpenses: [{ category: 'Shopping', monthlyAmount: 1500, volatility: 0 }],
  };
}

const sumVariable = (r: ReturnType<typeof calculateDeterministicForecast>) =>
  r.daily.reduce((s, d) => s + d.variableExpenses, 0);
const endingOperating = (r: ReturnType<typeof calculateDeterministicForecast>) =>
  r.daily.at(-1)!.operatingCash;

describe('adaptiveSpending – Gegensteuern bei Knappheit', () => {
  describe('Normal Behavior', () => {
    it('hält den Saldo über der Schwelle, indem variable Ausgaben gedrosselt werden', () => {
      const without = calculateDeterministicForecast(spendyInput(), CONFIG);
      const withAdaptive = calculateDeterministicForecast(spendyInput(), {
        ...CONFIG,
        adaptiveSpending: { maxReductionPct: 1 },
      });

      // Ohne Gegensteuern: Pufferbruch. Mit: bleibt an der Schwelle.
      expect(without.risk.lowestBalance).toBeLessThan(1000);
      expect(withAdaptive.risk.lowestBalance).toBeGreaterThanOrEqual(1000 - 1);
      expect(withAdaptive.risk.daysBelowSafetyBuffer).toBeLessThan(
        without.risk.daysBelowSafetyBuffer,
      );

      // Es wurde weniger ausgegeben -> mehr Geld übrig.
      expect(sumVariable(withAdaptive)).toBeLessThan(sumVariable(without));
      expect(endingOperating(withAdaptive)).toBeGreaterThan(endingOperating(without));
    });

    it('begrenzt die Drosselung über maxReductionPct (teilweises Gegensteuern)', () => {
      const without = calculateDeterministicForecast(spendyInput(), CONFIG);
      const partial = calculateDeterministicForecast(spendyInput(), {
        ...CONFIG,
        adaptiveSpending: { maxReductionPct: 0.3 },
      });
      const full = calculateDeterministicForecast(spendyInput(), {
        ...CONFIG,
        adaptiveSpending: { maxReductionPct: 1 },
      });

      // Teilweises Gegensteuern liegt zwischen „gar nicht" und „voll".
      expect(partial.risk.lowestBalance).toBeGreaterThan(without.risk.lowestBalance);
      expect(partial.risk.lowestBalance).toBeLessThan(full.risk.lowestBalance);
      expect(sumVariable(full)).toBeLessThan(sumVariable(partial));
      expect(sumVariable(partial)).toBeLessThan(sumVariable(without));
    });

    it('respektiert eine eigene Schwelle (threshold) statt des Sicherheitspuffers', () => {
      const withAdaptive = calculateDeterministicForecast(spendyInput(), {
        ...CONFIG,
        adaptiveSpending: { threshold: 1500, maxReductionPct: 1 },
      });
      expect(withAdaptive.risk.lowestBalance).toBeGreaterThanOrEqual(1500 - 1);
    });
  });

  describe('Edge Cases', () => {
    it('drosselt nur Variable – ein durch Fixkosten verursachtes Tief bleibt', () => {
      const fixedDip: ForecastInput = {
        accounts: [checking(1200)],
        recurringFlows: [
          { id: 'salary', name: 'Gehalt', amount: 1500, cadence: 'monthly', anchorDate: START, accountId: 'giro' },
          { id: 'rent', name: 'Miete', amount: -2000, cadence: 'monthly', anchorDate: START, accountId: 'giro' },
        ],
      };
      const without = calculateDeterministicForecast(fixedDip, CONFIG);
      const withAdaptive = calculateDeterministicForecast(fixedDip, {
        ...CONFIG,
        adaptiveSpending: { maxReductionPct: 1 },
      });
      // Keine variablen Ausgaben zum Drosseln -> identisch.
      expect(withAdaptive.risk.lowestBalance).toBeCloseTo(without.risk.lowestBalance, 2);
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] ohne adaptiveSpending bleibt das Ergebnis unverändert', () => {
      const baseline = calculateDeterministicForecast(spendyInput(), CONFIG);
      const explicitOff = calculateDeterministicForecast(spendyInput(), {
        ...CONFIG,
        adaptiveSpending: { maxReductionPct: 0 },
      });
      // maxReductionPct 0 = kein Effekt -> tagesgenau identisch zur Baseline.
      expect(explicitOff.daily).toEqual(baseline.daily);
    });
  });
});
