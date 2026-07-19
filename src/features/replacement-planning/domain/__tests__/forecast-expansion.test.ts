import { describe, it, expect } from 'vitest';
import { expandReplacementPlans } from '../forecast-expansion';
import { calculateDeterministicForecast } from '@/lib/forecast';
import type { ForecastAccount, ForecastInput } from '@/lib/forecast-types';
import type { ReplacementPlan } from '../replacement-plan';

const START = '2026-01-01';

function plan(overrides: Partial<ReplacementPlan> = {}): ReplacementPlan {
  return {
    id: 'rp1',
    name: 'Waschmaschine',
    replacement_cost_minor: 60000, // 600 €
    lifespan_months: 120,
    reserve_minor: 0,
    price_mode: 'stable',
    planned_replacement_date: '2026-07-01',
    reserve_account_id: 'res',
    funded_from_account_id: 'op',
    ...overrides,
  };
}

describe('expandReplacementPlans (A2, #240)', () => {
  it('sollte Rücklagen-Transfer und Ersatz-Event erzeugen', () => {
    const { transfers, events } = expandReplacementPlans([plan()], START, 'op');

    const expense = events.find((e) => e.id === 'rp-rp1-expense');
    expect(expense).toBeDefined();
    expect(expense?.amount).toBe(-600); // voller Abfluss in Euro
    expect(expense?.date).toBe('2026-07-01');
    expect(expense?.accountId).toBe('res');

    const contrib = transfers.find((t) => t.id === 'rp-rp1-contrib');
    expect(contrib).toBeDefined();
    expect(contrib?.amount).toBe(100); // 600 € / 6 Monate
    expect(contrib?.fromAccountId).toBe('op');
    expect(contrib?.toAccountId).toBe('res');
    expect(contrib?.cadence).toBe('monthly');
  });

  it('(c) sollte den Restwert als SEPARATEN Zufluss führen, ohne den Abfluss zu verrechnen', () => {
    const { events } = expandReplacementPlans([plan({ residual_value_minor: 6000 })], START, 'op');

    const expense = events.find((e) => e.id === 'rp-rp1-expense');
    const residual = events.find((e) => e.id === 'rp-rp1-residual');
    expect(expense?.amount).toBe(-600); // unverändert voller Abfluss (kein Netting)
    expect(residual?.amount).toBe(60); // +60 € separater Zufluss
    expect(residual?.date).toBe('2026-07-01');
  });

  it('sollte vergangene Ersatztermine überspringen', () => {
    const { transfers, events } = expandReplacementPlans(
      [plan({ planned_replacement_date: '2025-01-01' })],
      START,
      'op',
    );
    expect(events).toHaveLength(0);
    expect(transfers).toHaveLength(0);
  });

  it('sollte ohne Konto nichts platzieren, aber mit Default-Konto den Ersatz buchen', () => {
    const withoutAccount = expandReplacementPlans(
      [plan({ reserve_account_id: undefined, funded_from_account_id: undefined })],
      START,
      null,
    );
    expect(withoutAccount.events).toHaveLength(0);

    const withDefault = expandReplacementPlans(
      [plan({ reserve_account_id: undefined, funded_from_account_id: undefined })],
      START,
      'op',
    );
    expect(withDefault.events.find((e) => e.id === 'rp-rp1-expense')?.accountId).toBe('op');
    // Ohne Reservekonto kein Rücklagen-Transfer.
    expect(withDefault.transfers).toHaveLength(0);
  });
});

describe('[INTEGRITY] Ersatzplan wirkt genau einmal saldowirksam (Invariante 22/23)', () => {
  const accounts: ForecastAccount[] = [
    { id: 'op', name: 'Giro', kind: 'checking', openingBalance: 5000 },
    { id: 'res', name: 'Reserve', kind: 'savings', openingBalance: 0 },
  ];
  const config = { startDate: START, months: 6 };

  it('sollte das Gesamtvermögen genau um den Ersatz-Abfluss senken — Transfer neutral, keine Nutzungskosten-Leckage', () => {
    const p = plan({ planned_replacement_date: '2026-04-01', residual_value_minor: 0 });

    const baseline = calculateDeterministicForecast({ accounts }, config);

    const expansion = expandReplacementPlans([p], START, 'op');
    const withPlan: ForecastInput = {
      accounts,
      transfers: expansion.transfers,
      plannedEvents: expansion.events,
    };
    const result = calculateDeterministicForecast(withPlan, config);

    const baseEnd = baseline.daily.at(-1)!.netWorth;
    const planEnd = result.daily.at(-1)!.netWorth;

    // Genau der Ersatz-Abfluss (600 €) — nicht mehr (keine doppelte/dreifache
    // Erfassung durch Nutzungskosten) und nicht weniger (der Transfer ist neutral).
    expect(baseEnd - planEnd).toBe(600);
  });

  it('sollte bei Restwert das Gesamtvermögen um (Abfluss − Restwert) senken', () => {
    const p = plan({ planned_replacement_date: '2026-04-01', residual_value_minor: 15000 }); // 150 € Restwert

    const baseline = calculateDeterministicForecast({ accounts }, config);
    const expansion = expandReplacementPlans([p], START, 'op');
    const result = calculateDeterministicForecast(
      { accounts, transfers: expansion.transfers, plannedEvents: expansion.events },
      config,
    );

    const baseEnd = baseline.daily.at(-1)!.netWorth;
    const planEnd = result.daily.at(-1)!.netWorth;
    expect(baseEnd - planEnd).toBe(450); // 600 − 150
  });
});
