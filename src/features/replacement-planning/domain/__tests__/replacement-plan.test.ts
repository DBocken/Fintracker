import { describe, it, expect } from 'vitest';
import {
  resolveReplacementDate,
  developedReplacementCostMinor,
  monthlyUsageCostMinor,
  monthlyReserveContributionMinor,
  monthsUntilReplacement,
  replacementCashflow,
  buildReplacementViewModel,
  DEFAULT_INFLATION_RATE,
  type ReplacementPlan,
  type ReplacementConfig,
} from '../replacement-plan';

const CONFIG: ReplacementConfig = { today: '2026-01-01' };

function plan(overrides: Partial<ReplacementPlan> = {}): ReplacementPlan {
  return {
    id: 'rp-1',
    name: 'Waschmaschine',
    replacement_cost_minor: 60000, // 600 €
    lifespan_months: 120, // 10 Jahre
    reserve_minor: 0,
    price_mode: 'stable',
    ...overrides,
  };
}

describe('Ersatztermin-Auflösung', () => {
  it('sollte den expliziten Fixtermin bevorzugen', () => {
    expect(resolveReplacementDate(plan({ planned_replacement_date: '2031-01-01' }), CONFIG)).toBe(
      '2031-01-01',
    );
  });

  it('sollte Kaufdatum + Lebensdauer nutzen, wenn kein Fixtermin gesetzt ist', () => {
    expect(resolveReplacementDate(plan({ purchase_date: '2020-01-01' }), CONFIG)).toBe('2030-01-01');
  });

  it('sollte heute + Restlebensdauer nutzen, wenn nur diese bekannt ist', () => {
    expect(resolveReplacementDate(plan({ remaining_lifespan_months: 24 }), CONFIG)).toBe(
      '2028-01-01',
    );
  });

  it('sollte auf heute + Lebensdauer zurückfallen', () => {
    expect(resolveReplacementDate(plan(), CONFIG)).toBe('2036-01-01');
  });
});

describe('Preisentwicklung', () => {
  it('sollte im Modus „stabil" den Preis unverändert lassen', () => {
    expect(
      developedReplacementCostMinor(plan({ planned_replacement_date: '2031-01-01' }), CONFIG),
    ).toBe(60000);
  });

  it('sollte im Modus „inflation" den Preis über die Zeit erhöhen', () => {
    const developed = developedReplacementCostMinor(
      plan({ price_mode: 'inflation', planned_replacement_date: '2031-01-01' }),
      CONFIG,
    );
    expect(developed).toBeGreaterThan(60000);
  });

  it('sollte im Modus „individual" die eigene Rate anwenden (höhere Rate ⇒ höherer Preis)', () => {
    const inflation = developedReplacementCostMinor(
      plan({ price_mode: 'inflation', planned_replacement_date: '2031-01-01' }),
      CONFIG,
    );
    const individual = developedReplacementCostMinor(
      plan({ price_mode: 'individual', price_rate_annual: 0.05, planned_replacement_date: '2031-01-01' }),
      CONFIG,
    );
    expect(individual).toBeGreaterThan(inflation);
  });

  it('sollte DEFAULT_INFLATION_RATE als lokalen Standard verwenden', () => {
    expect(DEFAULT_INFLATION_RATE).toBe(0.02);
  });
});

describe('Drei-Sichten-Trennung (keine Doppelzählung, AD3)', () => {
  const p = plan({
    replacement_cost_minor: 60000,
    lifespan_months: 120,
    residual_value_minor: 6000,
    price_mode: 'inflation',
    planned_replacement_date: '2031-01-01',
  });

  it('(a) sollte Nutzungskosten inflationsneutral als (Preis − Restwert)/Lebensdauer berechnen', () => {
    // (60000 − 6000) / 120 = 450 Cent/Monat — unabhängig vom Ersatztermin/Inflation.
    expect(monthlyUsageCostMinor(p)).toBe(450);
  });

  it('(b) sollte den Rücklagenbeitrag auf den ZUKÜNFTIGEN Preis über die Restmonate verteilen', () => {
    const stableReserve = monthlyReserveContributionMinor(
      plan({ replacement_cost_minor: 60000, planned_replacement_date: '2031-01-01', price_mode: 'stable' }),
      CONFIG,
    );
    // stabil: 60000 / 60 Monate = 1000 Cent/Monat (exakt).
    expect(stableReserve).toBe(1000);
    expect(monthsUntilReplacement(p, CONFIG)).toBe(60);
  });

  it('(c) sollte den Restwert als SEPARATEN Zufluss führen, nicht gegen den Abfluss verrechnen (D5)', () => {
    const cf = replacementCashflow(p, CONFIG);
    expect(cf.residualInflowMinor).toBe(6000);
    expect(cf.outflowMinor).toBe(developedReplacementCostMinor(p, CONFIG));
    // Kein Netting: der Abfluss ist der volle preisentwickelte Preis.
    expect(cf.outflowMinor).toBeGreaterThan(60000);
  });

  it('sollte die drei Sichten als DISTINKTE Zahlen liefern (keine dreifache Erfassung)', () => {
    const vm = buildReplacementViewModel(p, CONFIG);
    // Nutzungskosten (heutiges Geld) ≠ Rücklagenbeitrag (Zukunftspreis/Restmonate)
    // ≠ Ersatz-Cashflow (Einmalabfluss).
    expect(vm.monthlyUsageCostMinor).not.toBe(vm.monthlyReserveContributionMinor);
    expect(vm.cashflow.outflowMinor).not.toBe(vm.monthlyUsageCostMinor);
    expect(vm.cashflow.outflowMinor).not.toBe(vm.monthlyReserveContributionMinor);
  });
});

describe('Rücklagenbeitrag', () => {
  it('sollte bereits vorhandene Rücklage abziehen', () => {
    const withReserve = monthlyReserveContributionMinor(
      plan({ replacement_cost_minor: 60000, reserve_minor: 30000, planned_replacement_date: '2031-01-01', price_mode: 'stable' }),
      CONFIG,
    );
    // (60000 − 30000) / 60 = 500 Cent/Monat.
    expect(withReserve).toBe(500);
  });

  it('sollte nie negativ werden, wenn die Rücklage schon reicht', () => {
    const overfunded = monthlyReserveContributionMinor(
      plan({ replacement_cost_minor: 60000, reserve_minor: 90000, planned_replacement_date: '2031-01-01', price_mode: 'stable' }),
      CONFIG,
    );
    expect(overfunded).toBe(0);
  });
});
