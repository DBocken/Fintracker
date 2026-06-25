import { describe, it, expect } from 'vitest';
import { calculateDeterministicForecast } from '../forecast';
import type { ForecastAccount, ForecastConfig, ForecastInput } from '../forecast-types';

const START = '2026-01-01';

function inputWith(account: ForecastAccount): ForecastInput {
  // Keine Flows: der Saldo bleibt – abgesehen von Zinsen – konstant.
  return { accounts: [account], recurringFlows: [], variableExpenses: [] };
}

const config: ForecastConfig = { startDate: START, months: 6 };

describe('Forecast Core – Dispozins auf negative Salden', () => {
  describe('Normal Behavior', () => {
    it('sollte ein überzogenes Girokonto monatlich mit Dispozins belasten', () => {
      const result = calculateDeterministicForecast(
        inputWith({ id: 'giro', name: 'Giro', kind: 'checking', openingBalance: -1000 }),
        { ...config, overdraftAnnualRate: 12 },
      );
      const end = result.daily.at(-1)!.operatingCash;
      // 12 % p. a. ≈ 1 %/Monat auf den (wachsenden) Minus-Saldo -> deutlich unter -1000.
      expect(end).toBeLessThan(-1000);
      // Mindestens ein Monatsende weist negative Netto-Zinsen aus.
      expect(result.daily.some((p) => p.interest < 0)).toBe(true);
    });

    it('sollte positive Salden weiterhin verzinsen (Dispozins betrifft nur Minus)', () => {
      const result = calculateDeterministicForecast(
        inputWith({
          id: 'giro',
          name: 'Giro',
          kind: 'checking',
          openingBalance: 1000,
          annualInterestRate: 12,
        }),
        { ...config, overdraftAnnualRate: 12 },
      );
      expect(result.daily.at(-1)!.operatingCash).toBeGreaterThan(1000);
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte ohne overdraftAnnualRate (Default 0) zinsfrei bleiben', () => {
      const result = calculateDeterministicForecast(
        inputWith({ id: 'giro', name: 'Giro', kind: 'checking', openingBalance: -1000 }),
        config,
      );
      expect(result.daily.at(-1)!.operatingCash).toBe(-1000);
    });

    it('sollte ein nicht-operatives Konto (Sparkonto) NICHT mit Dispozins belasten', () => {
      const result = calculateDeterministicForecast(
        inputWith({ id: 'spar', name: 'Tagesgeld', kind: 'savings', openingBalance: -1000 }),
        { ...config, overdraftAnnualRate: 12 },
      );
      // availableCash schließt das Sparkonto ein; ohne Dispozins bleibt es bei -1000.
      expect(result.daily.at(-1)!.availableCash).toBe(-1000);
    });
  });
});
