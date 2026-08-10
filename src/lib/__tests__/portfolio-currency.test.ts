/**
 * Währungsgrenze der Depot-Rechnung (VE-1, WP 7.7).
 *
 * Die Service-Tests belegen den Regelfall am echten Speicher; hier stehen die
 * Grenzfälle der reinen Funktion — Schreibweise, fehlende Angabe, mehrere
 * Fremdwährungen im selben Depot.
 */
import { describe, it, expect } from 'vitest';
import { toMinor } from '../money';
import type { PortfolioSummary } from '../portfolio-types';
import { eurContribution, isSameCurrency } from '../portfolio-currency';

function summary(overrides: Partial<PortfolioSummary> = {}): PortfolioSummary {
  return {
    total_value: 0,
    total_cost: 0,
    unrealized_gain_loss: 0,
    unrealized_gain_loss_percent: 0,
    positions_count: 0,
    currency: 'EUR',
    unconverted_positions: [],
    ...overrides,
  };
}

describe('isSameCurrency', () => {
  it('sollte Schreibweise und Leerraum ignorieren', () => {
    expect(isSameCurrency(' eur ', 'EUR')).toBe(true);
    expect(isSameCurrency('usd', 'EUR')).toBe(false);
  });

  it('sollte eine fehlende Angabe als Bezugswährung lesen', () => {
    // Bestandszeilen aus der Zeit vor dem Währungsfeld wurden unter der
    // Depotwährung angelegt — sie nachträglich auszubuchen wäre die zweite
    // Falschaussage nach der ersten.
    expect(isSameCurrency(undefined, 'EUR')).toBe(true);
    expect(isSameCurrency('', 'USD')).toBe(true);
  });
});

describe('eurContribution', () => {
  it('sollte ein EUR-Depot vollständig übernehmen', () => {
    const result = eurContribution(summary({ total_value: 1000, positions_count: 2 }));

    expect(toMinor(result.eurValue)).toBe(toMinor(1000));
    expect(result.eurPositionsCount).toBe(2);
    expect(result.unconverted).toEqual([]);
  });

  it('[REGRESSION] sollte ein Depot in Fremdwährung vollständig heraushalten', () => {
    const result = eurContribution(summary({ currency: 'USD', total_value: 3894.1, positions_count: 2 }));

    expect(result.eurValue).toBe(0);
    expect(result.eurPositionsCount).toBe(0);
    expect(result.unconverted).toEqual([{ currency: 'USD', value: 3894.1, positionsCount: 2 }]);
  });

  it('sollte mehrere Fremdwährungen je Währung bündeln', () => {
    const result = eurContribution(
      summary({
        total_value: 1000,
        positions_count: 4,
        unconverted_positions: [
          { id: '1', symbol: 'AAPL', currency: 'USD', value: 892.5 },
          { id: '2', symbol: 'MSFT', currency: 'usd', value: 100 },
          { id: '3', symbol: 'NESN', currency: 'CHF', value: 250 },
        ],
      }),
    );

    expect(toMinor(result.eurValue)).toBe(toMinor(1000));
    expect(result.eurPositionsCount).toBe(1);
    expect(result.unconverted).toEqual([
      { currency: 'USD', value: 992.5, positionsCount: 2 },
      { currency: 'CHF', value: 250, positionsCount: 1 },
    ]);
  });

  it('sollte die EUR-Position eines USD-Depots trotzdem ins Vermögen nehmen', () => {
    const result = eurContribution(
      summary({
        currency: 'USD',
        total_value: 892.5,
        positions_count: 2,
        unconverted_positions: [{ id: '1', symbol: 'SAP', currency: 'EUR', value: 1000 }],
      }),
    );

    expect(toMinor(result.eurValue)).toBe(toMinor(1000));
    expect(result.eurPositionsCount).toBe(1);
    expect(result.unconverted).toEqual([{ currency: 'USD', value: 892.5, positionsCount: 1 }]);
  });

  it('sollte ein leeres Fremdwährungsdepot nicht als Bestand ausweisen', () => {
    const result = eurContribution(summary({ currency: 'USD' }));

    expect(result.unconverted).toEqual([]);
  });
});
