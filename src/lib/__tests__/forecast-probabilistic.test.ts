import { describe, it, expect } from 'vitest';
import { calculateDeterministicForecast } from '../forecast';
import { runMonteCarloForecast } from '../forecast-montecarlo';
import type { ForecastAccount, ForecastInput, ProbabilisticPlannedEvent } from '../forecast-types';

const START = '2026-01-01';
const accounts: ForecastAccount[] = [{ id: 'op', name: 'Giro', kind: 'checking', openingBalance: 100000 }];
const config = { startDate: START, months: 6 };

function probEvent(overrides: Partial<ProbabilisticPlannedEvent> = {}): ProbabilisticPlannedEvent {
  return {
    id: 'e1',
    name: 'Waschmaschine',
    amountMean: -600,
    amountCv: 0.1,
    earliestDate: '2026-03-01',
    likelyDate: '2026-04-01',
    latestDate: '2026-05-01',
    accountId: 'op',
    ...overrides,
  };
}

describe('Probabilistische Ereignisse — deterministischer Kern (A3, #241)', () => {
  it('sollte den Erwartungswert (Mittelbetrag am wahrscheinlichen Datum) buchen', () => {
    const input: ForecastInput = { accounts, probabilisticEvents: [probEvent()] };
    const result = calculateDeterministicForecast(input, config);
    // 100000 − 600 = 99400 am Horizontende.
    expect(result.daily.at(-1)!.netWorth).toBe(99400);
    // Vor dem wahrscheinlichen Datum noch unberührt.
    const beforeEvent = result.daily.find((d) => d.date === '2026-03-15');
    expect(beforeEvent!.netWorth).toBe(100000);
  });
});

describe('Probabilistische Ereignisse — Monte-Carlo (A3, #241)', () => {
  it('sollte bei gleichem Seed reproduzierbar sein', () => {
    const input: ForecastInput = { accounts, probabilisticEvents: [probEvent()] };
    const a = runMonteCarloForecast(input, config, { trials: 200, seed: 7 });
    const b = runMonteCarloForecast(input, config, { trials: 200, seed: 7 });
    expect(a.band).toEqual(b.band);
    expect(a.endingNetWorth).toEqual(b.endingNetWorth);
  });

  it('[INTEGRITY] sollte den Erwartungswert wahren — genau EINMAL gebucht (keine Doppelbuchung)', () => {
    const input: ForecastInput = { accounts, probabilisticEvents: [probEvent()] };
    const mc = runMonteCarloForecast(input, config, { trials: 400, seed: 1 });
    // Mittelwert nahe 99400 (nicht 98800 = doppelt gebucht, nicht 100000 = gar nicht).
    expect(mc.endingNetWorth.mean).toBeGreaterThan(99000);
    expect(mc.endingNetWorth.mean).toBeLessThan(99800);
  });

  it('sollte durch die Preisunsicherheit eine Streuung erzeugen (P10 < P90)', () => {
    const input: ForecastInput = { accounts, probabilisticEvents: [probEvent({ amountCv: 0.2 })] };
    const mc = runMonteCarloForecast(input, config, { trials: 400, seed: 1 });
    expect(mc.endingNetWorth.p10).toBeLessThan(mc.endingNetWorth.p90);
  });

  it('sollte ohne probabilistische Ereignisse identisch zum reinen Baseline-Lauf bleiben (RNG-Sequenz)', () => {
    const withEmpty = runMonteCarloForecast({ accounts, probabilisticEvents: [] }, config, { trials: 100, seed: 3 });
    const without = runMonteCarloForecast({ accounts }, config, { trials: 100, seed: 3 });
    expect(withEmpty.band).toEqual(without.band);
  });
});
