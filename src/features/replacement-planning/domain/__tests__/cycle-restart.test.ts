import { describe, it, expect } from 'vitest';
import { restartReplacementCycle } from '../cycle-restart';
import { resolveReplacementDate } from '../replacement-plan';
import type { ReplacementPlan } from '../replacement-plan';

function plan(overrides: Partial<ReplacementPlan> = {}): ReplacementPlan {
  return {
    id: 'rp1',
    name: 'Waschmaschine',
    replacement_cost_minor: 60000,
    lifespan_months: 120,
    reserve_minor: 62000,
    price_mode: 'stable',
    planned_replacement_date: '2026-04-01',
    cycle_count: 0,
    ...overrides,
  };
}

describe('restartReplacementCycle (A5, #243)', () => {
  it('sollte den Zyklus neu starten: neues Kaufdatum, Rücklage 0, cycle_count+1', () => {
    const restarted = restartReplacementCycle(plan(), {
      replacementDate: '2026-04-01',
      actualCostMinor: 61000,
      transactionId: 'tx-99',
    });

    expect(restarted.purchase_date).toBe('2026-04-01');
    expect(restarted.replacement_cost_minor).toBe(61000); // neue Preisbasis
    expect(restarted.reserve_minor).toBe(0); // ohne Übernahme zurückgesetzt
    expect(restarted.planned_replacement_date).toBeUndefined(); // Alttermin entfernt
    expect(restarted.last_replacement_transaction_id).toBe('tx-99');
    expect(restarted.cycle_count).toBe(1);
  });

  it('sollte den neuen Ersatztermin aus Kaufdatum + Lebensdauer ableiten', () => {
    const restarted = restartReplacementCycle(plan({ lifespan_months: 120 }), {
      replacementDate: '2026-04-01',
    });
    // 2026-04-01 + 120 Monate = 2036-04-01.
    expect(resolveReplacementDate(restarted, { today: '2026-04-01' })).toBe('2036-04-01');
  });

  it('sollte einen Über-Rücklagen-Rest übernehmen, wenn gewünscht', () => {
    const restarted = restartReplacementCycle(plan({ reserve_minor: 62000 }), {
      replacementDate: '2026-04-01',
      actualCostMinor: 60000,
      carryReserveRemainder: true,
    });
    // 62000 − 60000 = 2000 Cent Rest.
    expect(restarted.reserve_minor).toBe(2000);
  });

  it('sollte nie einen negativen Rücklagenrest übernehmen (unterfinanziert ⇒ 0)', () => {
    const restarted = restartReplacementCycle(plan({ reserve_minor: 40000 }), {
      replacementDate: '2026-04-01',
      actualCostMinor: 60000,
      carryReserveRemainder: true,
    });
    expect(restarted.reserve_minor).toBe(0);
  });
});
