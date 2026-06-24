import { describe, it, expect } from 'vitest';
import {
  buildBaseCheckPayload,
  buildHigherCostPayload,
  buildIncomeLossPayload,
  buildLargePurchasePayload,
  buildShockRecoveryPayload,
  type QuestionContext,
} from '../scenario-questions';

const CTX: QuestionContext = { horizonDays: 180, thresholdAmount: 1000 };

describe('Szenario-Frage-Builder', () => {
  it('base_check liefert ein eingriffsfreies Payload', () => {
    const p = buildBaseCheckPayload(CTX);
    expect(p.scenarioType).toBe('base_check');
    expect(p.events).toBeUndefined();
    expect(p.thresholdAmount).toBe(1000);
  });

  it('large_purchase setzt einen expense-Event am Zieltag', () => {
    const p = buildLargePurchasePayload(3000, 60, CTX);
    expect(p.scenarioType).toBe('large_purchase');
    expect(p.events).toHaveLength(1);
    expect(p.events![0]).toMatchObject({ eventType: 'expense', amount: 3000, dayIndex: 60 });
  });

  it('income_loss verteilt den Monatsausfall als tägliche Reduktion über das Fenster', () => {
    const p = buildIncomeLossPayload(2000, 3, CTX);
    expect(p.scenarioType).toBe('income_loss');
    const evt = p.events![0];
    expect(evt.eventType).toBe('income_reduction');
    // 3 Monate ≈ 91 Tage -> endDayIndex ~ 90, innerhalb des Horizonts.
    expect(evt.startDayIndex).toBe(0);
    expect(evt.endDayIndex).toBeGreaterThan(85);
    expect(evt.endDayIndex).toBeLessThanOrEqual(CTX.horizonDays - 1);
    // Tagesbetrag ≈ 2000 / 30.44.
    expect(evt.amount).toBeCloseTo(2000 / 30.44, 3);
  });

  it('income_loss kappt das Fenster am Horizont', () => {
    const p = buildIncomeLossPayload(2000, 24, { horizonDays: 90, thresholdAmount: 0 });
    expect(p.events![0].endDayIndex).toBe(89);
  });

  it('higher_cost_of_living setzt den baselineMultiplier', () => {
    const p = buildHigherCostPayload(20, CTX);
    expect(p.baselineMultiplier).toBeCloseTo(1.2, 6);
  });

  it('shock_recovery setzt Schock (expense) + Kompensation (income)', () => {
    const p = buildShockRecoveryPayload(4500, 25, 1800, 70, CTX);
    expect(p.events).toHaveLength(2);
    expect(p.events![0]).toMatchObject({ eventType: 'expense', amount: 4500, dayIndex: 25 });
    expect(p.events![1]).toMatchObject({ eventType: 'income', amount: 1800, dayIndex: 70 });
  });
});
