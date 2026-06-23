import { describe, it, expect } from 'vitest';
import { payloadToScenario } from '../scenario-payload-adapter';
import type { ScenarioPayload } from '../scenario-payload-types';

const START = '2026-01-01';

describe('payloadToScenario', () => {
  describe('Normal Behavior', () => {
    it('sollte large_purchase in einen negativen oneTime-Posten am richtigen Tag übersetzen', () => {
      const payload: ScenarioPayload = {
        scenarioId: 's1',
        scenarioType: 'large_purchase',
        timeHorizonDays: 90,
        events: [{ eventType: 'expense', amount: 3000, dayIndex: 60 }],
      };
      const scenario = payloadToScenario(payload, START);
      expect(scenario.modifiers).toHaveLength(1);
      const mod = scenario.modifiers[0];
      expect(mod.type).toBe('oneTime');
      expect(mod.amount).toBe(-3000);
      expect(mod.date).toBe('2026-03-02'); // 1. Jan + 60 Tage
    });

    it('sollte income (recovery) als positiven oneTime-Posten übersetzen', () => {
      const payload: ScenarioPayload = {
        scenarioId: 's2',
        scenarioType: 'shock_recovery',
        timeHorizonDays: 90,
        events: [
          { eventType: 'expense', amount: 4500, dayIndex: 25 },
          { eventType: 'income', amount: 1800, dayIndex: 70 },
        ],
      };
      const scenario = payloadToScenario(payload, START);
      expect(scenario.modifiers).toHaveLength(2);
      expect(scenario.modifiers[0].amount).toBe(-4500);
      expect(scenario.modifiers[1].amount).toBe(1800);
      expect(scenario.modifiers[1].type).toBe('oneTime');
    });

    it('sollte higher_cost_of_living/baselineMultiplier in einen variable-Modifier übersetzen', () => {
      const payload: ScenarioPayload = {
        scenarioId: 's3',
        scenarioType: 'higher_cost_of_living',
        timeHorizonDays: 90,
        baselineMultiplier: 1.2,
      };
      const scenario = payloadToScenario(payload, START);
      expect(scenario.modifiers).toHaveLength(1);
      expect(scenario.modifiers[0].type).toBe('variable');
      expect(scenario.modifiers[0].percentChange).toBeCloseTo(20, 6);
    });

    it('sollte income_reduction als tägliche oneTime-Posten über das Fenster abbilden', () => {
      const payload: ScenarioPayload = {
        scenarioId: 's4',
        scenarioType: 'income_loss',
        timeHorizonDays: 90,
        events: [
          { eventType: 'income_reduction', amount: 95, startDayIndex: 0, endDayIndex: 9 },
        ],
      };
      const scenario = payloadToScenario(payload, START);
      // 10 Tage (0..9) -> 10 Modifikatoren, jeder -95.
      expect(scenario.modifiers).toHaveLength(10);
      for (const mod of scenario.modifiers) {
        expect(mod.type).toBe('oneTime');
        expect(mod.amount).toBe(-95);
      }
      expect(scenario.modifiers[0].date).toBe('2026-01-01');
      expect(scenario.modifiers[9].date).toBe('2026-01-10');
    });
  });

  describe('Edge Cases', () => {
    it('sollte ohne Ereignisse und ohne Multiplikator ein leeres Szenario liefern', () => {
      const payload: ScenarioPayload = {
        scenarioId: 's5',
        scenarioType: 'base_check',
        timeHorizonDays: 90,
      };
      const scenario = payloadToScenario(payload, START);
      expect(scenario.modifiers).toHaveLength(0);
    });

    it('sollte baselineMultiplier === 1 ignorieren (kein No-Op-Modifier)', () => {
      const payload: ScenarioPayload = {
        scenarioId: 's6',
        scenarioType: 'higher_cost_of_living',
        timeHorizonDays: 90,
        baselineMultiplier: 1,
      };
      expect(payloadToScenario(payload, START).modifiers).toHaveLength(0);
    });

    it('sollte income_reduction mit gleichem Start/Ende als genau einen Tag abbilden', () => {
      const payload: ScenarioPayload = {
        scenarioId: 's7',
        scenarioType: 'income_loss',
        timeHorizonDays: 90,
        events: [{ eventType: 'income_reduction', amount: 50, startDayIndex: 5, endDayIndex: 5 }],
      };
      expect(payloadToScenario(payload, START).modifiers).toHaveLength(1);
    });
  });
});
