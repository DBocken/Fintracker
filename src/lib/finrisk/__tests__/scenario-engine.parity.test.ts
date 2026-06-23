import { describe, it, expect, vi } from 'vitest';
import { runScenarioPayload } from '../scenario-engine';
import type { ForecastAccount, ForecastConfig, ForecastInput, RecurringFlow } from '../../forecast-types';
import type { ScenarioPayload } from '../scenario-payload-types';

/**
 * Parität zum v27-Paket: bildet die Akzeptanztests aus
 * `tests/scenarioEngine.test.js` auf unsere ForecastInput-Form ab. Die exakte
 * Engine ist anders (echte Monte-Carlo-Pfade), die Produktaussagen sind identisch.
 */

const START = '2026-01-01';
const CONFIG: ForecastConfig = { startDate: START, months: 6, safetyBuffer: 1000 };
const MC = { trials: 300, seed: 1 };

function checking(openingBalance: number): ForecastAccount {
  return { id: 'giro', name: 'Girokonto', kind: 'checking', openingBalance };
}

const salary: RecurringFlow = {
  id: 'salary',
  name: 'Gehalt',
  amount: 2500,
  cadence: 'monthly',
  anchorDate: START,
  accountId: 'giro',
};

const rent: RecurringFlow = {
  id: 'rent',
  name: 'Miete',
  amount: -1000,
  cadence: 'monthly',
  anchorDate: START,
  accountId: 'giro',
};

function baseInput(): ForecastInput {
  return {
    accounts: [checking(12000)],
    recurringFlows: [salary, rent],
    variableExpenses: [{ category: 'Lebensmittel', monthlyAmount: 400, volatility: 0.1, confidence: 0.9 }],
  };
}

describe('FinRisk Szenario-Engine – Parität zum v27-Paket', () => {
  it('1. Large Purchase senkt den Endsaldo (≈ um den Betrag)', () => {
    const payload: ScenarioPayload = {
      scenarioId: 'large-purchase',
      scenarioType: 'large_purchase',
      timeHorizonDays: 90,
      thresholdAmount: 5000,
      probability: 1,
      events: [{ eventType: 'expense', amount: 3000, dayIndex: 60 }],
    };
    const result = runScenarioPayload(baseInput(), CONFIG, payload, { monteCarlo: MC });
    expect(result.scenarioEndP50).toBeLessThan(result.baselineEndP50);
    // Konstanter Schock bei gleichem Seed -> Delta der Mediane ≈ −3000.
    expect(result.deltaEndP50).toBeCloseTo(-3000, 1);
  });

  it('2. Income Loss senkt den erwarteten Endsaldo', () => {
    const payload: ScenarioPayload = {
      scenarioId: 'income-loss',
      scenarioType: 'income_loss',
      timeHorizonDays: 90,
      thresholdAmount: 5000,
      events: [{ eventType: 'income_reduction', amount: 95, startDayIndex: 0, endDayIndex: 89 }],
    };
    const result = runScenarioPayload(baseInput(), CONFIG, payload, { monteCarlo: MC });
    expect(result.scenarioEndP50).toBeLessThan(result.baselineEndP50);
  });

  it('3. Higher Cost of Living senkt die Pfade', () => {
    const payload: ScenarioPayload = {
      scenarioId: 'higher-cost',
      scenarioType: 'higher_cost_of_living',
      timeHorizonDays: 90,
      thresholdAmount: 5000,
      baselineMultiplier: 1.2,
    };
    const result = runScenarioPayload(baseInput(), CONFIG, payload, { monteCarlo: MC });
    expect(result.scenarioEndP50).toBeLessThan(result.baselineEndP50);
  });

  it('4. Shock + Recovery fällt, wird aber später teilweise kompensiert', () => {
    const payload: ScenarioPayload = {
      scenarioId: 'shock-recovery',
      scenarioType: 'shock_recovery',
      timeHorizonDays: 90,
      thresholdAmount: 5000,
      probability: 1,
      events: [
        { eventType: 'expense', amount: 4500, dayIndex: 25 },
        { eventType: 'income', amount: 1800, dayIndex: 70 },
      ],
    };
    const result = runScenarioPayload(baseInput(), CONFIG, payload, { monteCarlo: MC });
    expect(result.scenarioEndP50).toBeLessThan(result.baselineEndP50);
    // Recovery kompensiert -> Verschlechterung kleiner als der reine Schock.
    expect(result.baselineEndP50 - result.scenarioEndP50).toBeLessThan(4500);
  });

  it('5. Stress Capacity fällt mit höherem Sicherheitsniveau', () => {
    const payload: ScenarioPayload = {
      scenarioId: 'stress',
      scenarioType: 'stress_capacity',
      timeHorizonDays: 90,
      thresholdAmount: 5000,
      confidenceLevels: [0.8, 0.9, 0.95],
    };
    const result = runScenarioPayload(baseInput(), CONFIG, payload, { monteCarlo: MC });
    const [c80, c90, c95] = result.stressCapacity;
    expect(c80.maxAffordableShock).toBeGreaterThanOrEqual(c90.maxAffordableShock);
    expect(c90.maxAffordableShock).toBeGreaterThanOrEqual(c95.maxAffordableShock);
  });

  it('6. Erzeugt keine Netzwerk-Requests mit persönlichen Daten', () => {
    const fetchSpy = vi.fn();
    const original = globalThis.fetch;
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
    try {
      const payload: ScenarioPayload = {
        scenarioId: 'privacy',
        scenarioType: 'base_check',
        timeHorizonDays: 90,
        thresholdAmount: 5000,
      };
      runScenarioPayload(baseInput(), CONFIG, payload, { monteCarlo: MC });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = original;
    }
  });
});
