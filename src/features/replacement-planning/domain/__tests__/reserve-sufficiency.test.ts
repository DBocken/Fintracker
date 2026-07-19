import { describe, it, expect } from 'vitest';
import {
  reserveSufficiency,
  projectedReserveMinor,
  aggregateReplacementRisk,
  overlappingReplacements,
} from '../reserve-sufficiency';
import type { ReplacementConfig, ReplacementPlan } from '../replacement-plan';

const CONFIG: ReplacementConfig = { today: '2026-01-01' };

function plan(overrides: Partial<ReplacementPlan> = {}): ReplacementPlan {
  return {
    id: 'rp1',
    name: 'Waschmaschine',
    replacement_cost_minor: 60000,
    lifespan_months: 120,
    reserve_minor: 0,
    price_mode: 'inflation', // cv 0.10
    planned_replacement_date: '2028-01-01',
    ...overrides,
  };
}

describe('reserveSufficiency (A4, #242)', () => {
  it('sollte bei voll gedeckter Rücklage eine hohe Suffizienz und geringen Fehlbetrag liefern', () => {
    // Stabiler Preis ⇒ preisentwickelter Preis = heutiger Preis = 60000 = Rücklage.
    const p = plan({ price_mode: 'stable' });
    const s = reserveSufficiency(p, CONFIG, { reserveMinor: 60000 });
    // Reserve = Erwartungspreis ⇒ P(Preis ≤ Reserve) > 0.5 (Median < Mittel bei lognormal).
    expect(s.expectedCostMinor).toBe(60000);
    expect(s.sufficiencyProbability).toBeGreaterThan(0.5);
    expect(s.expectedShortfallMinor).toBeLessThan(60000 * 0.05);
  });

  it('sollte bei fehlender Rücklage Suffizienz 0 und Fehlbetrag ~ Erwartungspreis liefern', () => {
    const s = reserveSufficiency(plan({ reserve_minor: 0 }), CONFIG);
    expect(s.sufficiencyProbability).toBeCloseTo(0, 5);
    // E[max(0, Preis − 0)] = E[Preis] = erwarteter (preisentwickelter) Preis.
    expect(s.expectedShortfallMinor).toBe(s.expectedCostMinor);
  });

  it('sollte bei üppiger Rücklage Suffizienz ~1 und Fehlbetrag ~0 liefern', () => {
    const s = reserveSufficiency(plan(), CONFIG, { reserveMinor: 200000 });
    expect(s.sufficiencyProbability).toBeGreaterThan(0.999);
    expect(s.expectedShortfallMinor).toBe(0);
  });

  it('sollte bei größerer Preisunsicherheit (individual) einen höheren Fehlbetrag ergeben', () => {
    const base = reserveSufficiency(plan({ price_mode: 'stable' }), CONFIG, { reserveMinor: 60000 });
    const risky = reserveSufficiency(plan({ price_mode: 'individual' }), CONFIG, { reserveMinor: 60000 });
    expect(risky.expectedShortfallMinor).toBeGreaterThan(base.expectedShortfallMinor);
  });

  it('projectedReserveMinor sollte die voll angesparte Rücklage (~Erwartungspreis) liefern', () => {
    const p = plan({ reserve_minor: 0, price_mode: 'stable', planned_replacement_date: '2027-01-01' });
    const projected = projectedReserveMinor(p, CONFIG);
    // Vollfinanzierung ⇒ projizierte Rücklage ≈ Erwartungspreis 60000.
    expect(Math.abs(projected - 60000)).toBeLessThanOrEqual(60000 * 0.02);
  });
});

describe('aggregateReplacementRisk + overlappingReplacements (A4, #242)', () => {
  const plans = [
    plan({ id: 'a', reserve_minor: 0, planned_replacement_date: '2028-01-01' }),
    plan({ id: 'b', reserve_minor: 0, replacement_cost_minor: 30000, planned_replacement_date: '2028-02-15' }),
    plan({ id: 'c', reserve_minor: 500000, planned_replacement_date: '2030-01-01' }),
  ];

  it('sollte den erwarteten Gesamt-Fehlbetrag summieren und die schwächste Suffizienz nennen', () => {
    const agg = aggregateReplacementRisk(plans, CONFIG);
    const sum = agg.perPlan.reduce((s, p) => s + p.expectedShortfallMinor, 0);
    expect(agg.totalExpectedShortfallMinor).toBe(sum);
    expect(agg.minSufficiencyProbability).toBeCloseTo(0, 5); // a und b haben 0 Rücklage
  });

  it('sollte zeitlich nahe Ersatztermine als gemeinsamen Cluster erkennen', () => {
    const clusters = overlappingReplacements(plans, CONFIG, 3);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].planIds.sort()).toEqual(['a', 'b']); // Jan + Feb 2028
  });
});
