import { describe, it, expect } from 'vitest';
import { calculateDeterministicForecast } from '@/lib/forecast';
import { analyzeRisk } from '@/lib/forecast-insights';
import type { ForecastInput } from '@/lib/forecast-types';

const START = '2026-01-01';

function analyze(input: ForecastInput, config = {}) {
  const result = calculateDeterministicForecast(input, { startDate: START, months: 6, ...config });
  return { result, analysis: analyzeRisk(input, result) };
}

describe('analyzeRisk – Risikotreiber', () => {
  it('identifiziert den dominierenden Vertrag im Drawdown-Fenster', () => {
    const input: ForecastInput = {
      accounts: [{ id: 'giro', name: 'Giro', kind: 'checking', openingBalance: 2000 }],
      recurringFlows: [
        {
          id: 'ins',
          name: 'Kfz-Versicherung',
          amount: -1500,
          cadence: 'annual',
          anchorDate: '2026-03-15',
          accountId: 'giro',
        },
        {
          id: 'spotify',
          name: 'Spotify',
          amount: -10,
          cadence: 'monthly',
          anchorDate: '2026-01-05',
          accountId: 'giro',
        },
      ],
    };
    const { analysis } = analyze(input, { safetyBuffer: 1000 });
    expect(analysis.drivers[0].name).toBe('Kfz-Versicherung');
    expect(analysis.drivers[0].amount).toBe(1500);
    // Spotify zehrt den Saldo; Tief ab der letzten Buchung am 05.06. (danach flach).
    expect(analysis.troughDate).toBe('2026-06-05');
  });

  it('zählt mehrfache Buchungen im Fenster (occurrences)', () => {
    const input: ForecastInput = {
      accounts: [{ id: 'giro', name: 'Giro', kind: 'checking', openingBalance: 5000 }],
      recurringFlows: [
        {
          id: 'rent',
          name: 'Miete',
          amount: -900,
          cadence: 'monthly',
          anchorDate: '2026-01-01',
          accountId: 'giro',
        },
      ],
    };
    const { analysis } = analyze(input, { safetyBuffer: 100 });
    const rent = analysis.drivers.find((d) => d.name === 'Miete')!;
    // Tief liegt bei der letzten Miete; mehrere Mieten im Drawdown-Fenster.
    expect(rent.occurrences).toBeGreaterThanOrEqual(1);
    expect(rent.amount).toBe(900 * rent.occurrences!);
  });

  it('führt variable Ausgaben als eigenen Treiber', () => {
    const input: ForecastInput = {
      accounts: [{ id: 'giro', name: 'Giro', kind: 'checking', openingBalance: 1000 }],
      variableExpenses: [{ category: 'Shopping', monthlyAmount: 600 }],
    };
    const { analysis } = analyze(input, { safetyBuffer: 500 });
    expect(analysis.drivers.some((d) => d.kind === 'variable')).toBe(true);
  });
});

describe('analyzeRisk – Empfehlungen', () => {
  it('empfiehlt einen Rücktransfer, wenn Reserve verfügbar ist', () => {
    const input: ForecastInput = {
      accounts: [
        { id: 'giro', name: 'Giro', kind: 'checking', openingBalance: 800 },
        { id: 'tg', name: 'Tagesgeld', kind: 'savings', openingBalance: 5000 },
      ],
      recurringFlows: [
        {
          id: 'rent',
          name: 'Miete',
          amount: -600,
          cadence: 'monthly',
          anchorDate: '2026-01-10',
          accountId: 'giro',
        },
      ],
    };
    const { analysis } = analyze(input, { safetyBuffer: 1000, bufferBasis: 'operating' });
    expect(analysis.recommendation?.kind).toBe('transfer_from_reserve');
    // Fehlbetrag bis Puffer wird vom Tagesgeld gedeckt.
    expect(analysis.recommendation?.amount).toBeGreaterThan(0);
  });

  it('empfiehlt eine Rücklage bei dominierender Jahreszahlung ohne Reserve', () => {
    const input: ForecastInput = {
      accounts: [{ id: 'giro', name: 'Giro', kind: 'checking', openingBalance: 1200 }],
      recurringFlows: [
        {
          id: 'ins',
          name: 'Kfz-Versicherung',
          amount: -1000,
          cadence: 'annual',
          anchorDate: '2026-04-15',
          accountId: 'giro',
        },
      ],
    };
    const { analysis } = analyze(input, { safetyBuffer: 800 });
    expect(analysis.recommendation?.kind).toBe('build_sinking_fund');
    expect(analysis.recommendation?.amount).toBeGreaterThan(0);
  });

  it('gibt keine Empfehlung, wenn kein Pufferbruch vorliegt', () => {
    const input: ForecastInput = {
      accounts: [{ id: 'giro', name: 'Giro', kind: 'checking', openingBalance: 10_000 }],
    };
    const { analysis } = analyze(input, { safetyBuffer: 500 });
    expect(analysis.recommendation).toBeNull();
  });
});
