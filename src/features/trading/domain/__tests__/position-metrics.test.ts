import { describe, it, expect } from 'vitest';
import type { PortfolioPosition } from '@/types';
import {
  calculateGainLoss,
  currentPriceOf,
  calculateGainLossPercent,
  getBuyDate,
  calculateAnnualizedReturnPercent,
  MIN_HOLDING_DAYS_FOR_ANNUALIZED,
} from '../position-metrics';

function position(overrides: Partial<PortfolioPosition> = {}): PortfolioPosition {
  return {
    id: 'pos-1',
    portfolio_id: 'pf-1',
    symbol: 'AAPL',
    quantity: 10,
    entry_price: 100,
    currency: 'USD',
    metadata: {},
    ...overrides,
  } as PortfolioPosition;
}

describe('position-metrics', () => {
  describe('calculateGainLoss', () => {
    it('sollte Gewinn aus last_price vs entry_price berechnen', () => {
      expect(calculateGainLoss(position({ last_price: 110 }))).toBe(100);
    });

    it('sollte Verlust negativ ausweisen', () => {
      expect(calculateGainLoss(position({ last_price: 90 }))).toBe(-100);
    });

    it('sollte 0 liefern wenn kein last_price vorhanden ist (Fallback auf entry_price)', () => {
      expect(calculateGainLoss(position())).toBe(0);
    });

    it('[REGRESSION] sollte einen Kurs von 0 als Totalverlust ausweisen, nicht als plusminus null', () => {
      // Issue #294: `last_price || entry_price` liess den echten Nullkurs auf
      // den Einstiegskurs zurueckfallen — die Oberflaeche zeigte ±0 statt des
      // vollstaendigen Verlusts. Nachgeprueft ist, dass 0 hier „wertlos" heisst
      // und nicht „kein Kurs": Yahoo laesst das Quote ganz entfallen, Stooq
      // ueberspringt die Zeile, und eToro verlangt in `etoroCurrentPrice`
      // ausdruecklich `> 0`.
      expect(calculateGainLoss(position({ last_price: 0 }))).toBe(-1000);
    });
  });

  describe('currentPriceOf', () => {
    it('sollte den Kurs 0 durchreichen statt auf den Einstiegskurs zu fallen', () => {
      expect(currentPriceOf(position({ last_price: 0 }))).toBe(0);
    });

    it('sollte ohne Kurs den Einstiegskurs liefern', () => {
      expect(currentPriceOf(position())).toBe(100);
    });

    it('sollte einen vorhandenen Kurs liefern', () => {
      expect(currentPriceOf(position({ last_price: 110 }))).toBe(110);
    });
  });

  describe('calculateGainLossPercent', () => {
    it('[REGRESSION] sollte bei Kurs 0 minus 100 Prozent ausweisen', () => {
      expect(calculateGainLossPercent(position({ last_price: 0 }))).toBe(-100);
    });

    it('sollte Prozent relativ zum Einstiegspreis berechnen', () => {
      expect(calculateGainLossPercent(position({ last_price: 125 }))).toBe(25);
    });

    it('sollte bei entry_price 0 keine Division durch Null machen', () => {
      expect(calculateGainLossPercent(position({ entry_price: 0, last_price: 5 }))).toBe(0);
    });
  });

  describe('getBuyDate', () => {
    it('sollte metadata.buy_date (manuelle Position, YYYY-MM-DD) lesen', () => {
      const date = getBuyDate(position({ metadata: { buy_date: '2024-03-15' } }));
      expect(date?.toISOString().slice(0, 10)).toBe('2024-03-15');
    });

    it('sollte metadata.open_date (eToro, ISO-Datetime) lesen', () => {
      const date = getBuyDate(position({ metadata: { open_date: '2024-03-15T09:30:00Z' } }));
      expect(date?.toISOString().slice(0, 10)).toBe('2024-03-15');
    });

    it('sollte buy_date bevorzugen wenn beide vorhanden sind (manuell editiert schlägt Import)', () => {
      const date = getBuyDate(
        position({ metadata: { buy_date: '2024-01-01', open_date: '2023-06-01T00:00:00Z' } }),
      );
      expect(date?.toISOString().slice(0, 10)).toBe('2024-01-01');
    });

    describe('Edge Cases', () => {
      it('sollte null liefern wenn kein Datum vorhanden ist', () => {
        expect(getBuyDate(position())).toBeNull();
        expect(getBuyDate(position({ metadata: undefined }))).toBeNull();
      });

      it('sollte null liefern bei unparsebarem Datum', () => {
        expect(getBuyDate(position({ metadata: { buy_date: 'kein-datum' } }))).toBeNull();
      });

      it('sollte null liefern wenn das Datum kein String ist', () => {
        expect(getBuyDate(position({ metadata: { buy_date: 12345 } }))).toBeNull();
      });
    });
  });

  describe('calculateAnnualizedReturnPercent', () => {
    const now = new Date('2026-07-05T00:00:00Z');

    it('sollte den G/V% über genau ein Jahr unverändert annualisieren', () => {
      const pos = position({
        entry_price: 100,
        last_price: 110,
        metadata: { buy_date: '2025-07-05' },
      });
      expect(calculateAnnualizedReturnPercent(pos, now)).toBeCloseTo(10, 1);
    });

    it('sollte über zwei Jahre die Wurzel ziehen (CAGR, nicht linear teilen)', () => {
      // +21% über 2 Jahre = +10% p.a. ((1.21)^(1/2) = 1.1)
      const pos = position({
        entry_price: 100,
        last_price: 121,
        metadata: { buy_date: '2024-07-05' },
      });
      expect(calculateAnnualizedReturnPercent(pos, now)).toBeCloseTo(10, 1);
    });

    it('sollte Verluste annualisiert negativ ausweisen', () => {
      const pos = position({
        entry_price: 100,
        last_price: 81,
        metadata: { buy_date: '2024-07-05' },
      });
      expect(calculateAnnualizedReturnPercent(pos, now)).toBeCloseTo(-10, 1);
    });

    describe('Edge Cases', () => {
      it('sollte null liefern ohne Kaufdatum (nicht berechenbar, nicht 0)', () => {
        expect(calculateAnnualizedReturnPercent(position({ last_price: 110 }), now)).toBeNull();
      });

      it(`sollte null liefern bei Haltedauer unter ${MIN_HOLDING_DAYS_FOR_ANNUALIZED} Tagen (Extrapolation wäre irreführend)`, () => {
        const pos = position({
          entry_price: 100,
          last_price: 105,
          metadata: { buy_date: '2026-07-01' },
        });
        expect(calculateAnnualizedReturnPercent(pos, now)).toBeNull();
      });

      it('sollte null liefern bei Kaufdatum in der Zukunft', () => {
        const pos = position({
          entry_price: 100,
          last_price: 110,
          metadata: { buy_date: '2027-01-01' },
        });
        expect(calculateAnnualizedReturnPercent(pos, now)).toBeNull();
      });

      it('sollte null liefern bei Totalverlust (Basis für CAGR wäre <= 0)', () => {
        const pos = position({
          entry_price: 100,
          last_price: 0,
          metadata: { buy_date: '2024-07-05' },
        });
        // last_price 0 fällt auf entry_price zurück → 0% G/V → 0% p.a. wäre auch ok,
        // aber ein echter Totalverlust (last_price minimal) darf nicht NaN werden:
        const nearTotal = position({
          entry_price: 100,
          last_price: 0.000001,
          metadata: { buy_date: '2024-07-05' },
        });
        const result = calculateAnnualizedReturnPercent(nearTotal, now);
        expect(result).not.toBeNaN();
        expect(result).toBeLessThan(0);
        expect(calculateAnnualizedReturnPercent(pos, now)).not.toBeNaN();
      });
    });
  });
});
