import { describe, it, expect } from 'vitest';
import { normalizeSymbol, mapQuotesToPriceUpdates } from '../quote-service';
import type { QuoteData } from '../../types';

function quote(symbol: string, price: number): QuoteData {
  return { symbol, price, provider: 'yahoo' } as QuoteData;
}

describe('normalizeSymbol', () => {
  it('sollte XETRA-Symbole mit .DE-Suffix versehen', () => {
    expect(normalizeSymbol('VOW3', 'XETRA')).toBe('VOW3.DE');
    expect(normalizeSymbol('sap', 'XETRA')).toBe('SAP.DE');
  });

  it('sollte US-Symbole unverändert lassen', () => {
    expect(normalizeSymbol('AAPL', 'NASDAQ')).toBe('AAPL');
    expect(normalizeSymbol('MSFT')).toBe('MSFT');
  });
});

describe('mapQuotesToPriceUpdates', () => {
  const positions = [
    { id: 'p1', symbol: 'AAPL', exchange: 'NASDAQ' },
    { id: 'p2', symbol: 'VOW3', exchange: 'XETRA' },
    { id: 'p3', symbol: 'IE00B4L5Y983', exchange: 'XETRA' },
  ];

  describe('Normal Behavior', () => {
    it('sollte US-Positionen über das rohe Symbol matchen', () => {
      const updates = mapQuotesToPriceUpdates(positions, [quote('AAPL', 512.3)]);
      expect(updates).toEqual([{ id: 'p1', price: 512.3 }]);
    });

    it('[REGRESSION] sollte XETRA-Positionen über das börsennormalisierte Symbol (.DE) matchen', () => {
      // Vorher wurde nur das rohe Symbol verglichen — XETRA-Kurse (VOW3.DE)
      // fanden nie eine Position, die Kurse blieben scheinbar "eingefroren".
      const updates = mapQuotesToPriceUpdates(positions, [quote('VOW3.DE', 95.12)]);
      expect(updates).toEqual([{ id: 'p2', price: 95.12 }]);
    });
  });

  describe('Edge Cases', () => {
    it('sollte Positionen ohne passenden Kurs auslassen', () => {
      const updates = mapQuotesToPriceUpdates(positions, [quote('TSLA', 200)]);
      expect(updates).toEqual([]);
    });

    it('sollte mit leeren Listen umgehen', () => {
      expect(mapQuotesToPriceUpdates([], [])).toEqual([]);
      expect(mapQuotesToPriceUpdates(positions, [])).toEqual([]);
    });

    it('sollte Groß-/Kleinschreibung ignorieren', () => {
      const updates = mapQuotesToPriceUpdates(
        [{ id: 'p4', symbol: 'aapl', exchange: 'NASDAQ' }],
        [quote('AAPL', 100)],
      );
      expect(updates).toEqual([{ id: 'p4', price: 100 }]);
    });

    it('sollte ungültige Preise (0, NaN, negativ) verwerfen', () => {
      const updates = mapQuotesToPriceUpdates(positions, [
        quote('AAPL', 0),
        quote('VOW3.DE', NaN),
      ]);
      expect(updates).toEqual([]);
    });
  });
});
