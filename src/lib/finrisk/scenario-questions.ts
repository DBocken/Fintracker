/**
 * FinRisk – Szenario-Frage-Builder (PR 4)
 *
 * Übersetzt die Alltagsfragen der UI in stabile {@link ScenarioPayload}s. Reine
 * Funktionen, damit das Mapping unabhängig von der UI testbar bleibt (keine
 * Freitext-Magie im Rechenkern, wie in der Integration-Checklist gefordert).
 */
import type { ScenarioPayload } from './scenario-payload-types';

const AVG_DAYS_PER_MONTH = 30.44;

export interface QuestionContext {
  /** Horizont in Tagen (aus dem Forecast-Horizont abgeleitet). */
  horizonDays: number;
  /** Mindestpuffer in EUR. */
  thresholdAmount: number;
}

/** „Reicht mein Geld im normalen Alltag?" – Basisprüfung ohne Eingriff. */
export function buildBaseCheckPayload(ctx: QuestionContext): ScenarioPayload {
  return {
    scenarioId: 'base-check',
    scenarioType: 'base_check',
    timeHorizonDays: ctx.horizonDays,
    thresholdAmount: ctx.thresholdAmount,
  };
}

/** „Kann ich mir eine größere Anschaffung leisten?" */
export function buildLargePurchasePayload(
  amount: number,
  inDays: number,
  ctx: QuestionContext,
): ScenarioPayload {
  return {
    scenarioId: `large-purchase-${amount}-${inDays}`,
    scenarioType: 'large_purchase',
    timeHorizonDays: ctx.horizonDays,
    thresholdAmount: ctx.thresholdAmount,
    events: [
      {
        eventType: 'expense',
        amount: Math.abs(amount),
        dayIndex: Math.max(0, Math.round(inDays)),
        layer: 'lumpy_layer',
        description: 'Größere Anschaffung',
      },
    ],
  };
}

/** „Was passiert, wenn mein Einkommen ausfällt?" */
export function buildIncomeLossPayload(
  monthlyLoss: number,
  months: number,
  ctx: QuestionContext,
): ScenarioPayload {
  const windowDays = Math.max(1, Math.round(months * AVG_DAYS_PER_MONTH));
  return {
    scenarioId: `income-loss-${monthlyLoss}-${months}`,
    scenarioType: 'income_loss',
    timeHorizonDays: ctx.horizonDays,
    thresholdAmount: ctx.thresholdAmount,
    events: [
      {
        eventType: 'income_reduction',
        amount: Math.abs(monthlyLoss) / AVG_DAYS_PER_MONTH,
        startDayIndex: 0,
        endDayIndex: Math.min(windowDays - 1, ctx.horizonDays - 1),
        layer: 'income_layer',
        description: 'Einkommensausfall',
      },
    ],
  };
}

/** „Was, wenn mein Alltag teurer wird?" */
export function buildHigherCostPayload(percent: number, ctx: QuestionContext): ScenarioPayload {
  return {
    scenarioId: `higher-cost-${percent}`,
    scenarioType: 'higher_cost_of_living',
    timeHorizonDays: ctx.horizonDays,
    thresholdAmount: ctx.thresholdAmount,
    baselineMultiplier: 1 + percent / 100,
  };
}

/** „Auto kaputt, aber später mehr Gehalt" – Schock + spätere Kompensation. */
export function buildShockRecoveryPayload(
  shock: number,
  shockInDays: number,
  recovery: number,
  recoveryInDays: number,
  ctx: QuestionContext,
): ScenarioPayload {
  return {
    scenarioId: `shock-recovery-${shock}-${recovery}`,
    scenarioType: 'shock_recovery',
    timeHorizonDays: ctx.horizonDays,
    thresholdAmount: ctx.thresholdAmount,
    events: [
      {
        eventType: 'expense',
        amount: Math.abs(shock),
        dayIndex: Math.max(0, Math.round(shockInDays)),
        layer: 'stress_layer',
        description: 'Negativer Schock',
      },
      {
        eventType: 'income',
        amount: Math.abs(recovery),
        dayIndex: Math.max(0, Math.round(recoveryInDays)),
        layer: 'recovery_layer',
        description: 'Spätere Kompensation',
      },
    ],
  };
}
