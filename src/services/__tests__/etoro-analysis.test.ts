import { describe, it, expect } from 'vitest';
import { EtoroAggregatePortfolioResponseSchema } from '../etoro-api-schemas';
import {
  selectSectorExposure,
  selectFeesPnlBreakdown,
  selectFeesPnlTotals,
} from '../etoro-analysis';

describe('selectSectorExposure', () => {
  describe('Normal Behavior', () => {
    it('sollte Instrumente nach Branche gruppieren, Exposure summieren und Prozent-Anteil berechnen', () => {
      const aggregate = EtoroAggregatePortfolioResponseSchema.parse({
        instrumentAggregates: [
          { instrumentId: 1001, netCurrentExposureAccountCurrency: 600 },
          { instrumentId: 1002, netCurrentExposureAccountCurrency: 300 },
          { instrumentId: 1003, netCurrentExposureAccountCurrency: 100 },
        ],
      });
      const instrumentIndustryMap = new Map([
        [1001, 12],
        [1002, 12],
        [1003, 7],
      ]);
      const industryNameMap = new Map([
        [12, 'Technology'],
        [7, 'Healthcare'],
      ]);

      const result = selectSectorExposure(aggregate, instrumentIndustryMap, industryNameMap);
      expect(result).toEqual([
        { industryId: 12, industryName: 'Technology', exposure: 900, percent: 90 },
        { industryId: 7, industryName: 'Healthcare', exposure: 100, percent: 10 },
      ]);
    });

    it('sollte Short-Positionen (negative Exposure) absolut zur Branchen-Konzentration zählen', () => {
      const aggregate = EtoroAggregatePortfolioResponseSchema.parse({
        instrumentAggregates: [{ instrumentId: 1001, netCurrentExposureAccountCurrency: -500 }],
      });
      const result = selectSectorExposure(aggregate, new Map([[1001, 12]]), new Map([[12, 'Technology']]));
      expect(result[0].exposure).toBe(500);
    });
  });

  describe('Edge Cases', () => {
    it('sollte industryId=null und industryName=undefined liefern, wenn keine Branche zugeordnet ist', () => {
      const aggregate = EtoroAggregatePortfolioResponseSchema.parse({
        instrumentAggregates: [{ instrumentId: 1001, netCurrentExposureAccountCurrency: 100 }],
      });
      const result = selectSectorExposure(aggregate, new Map(), new Map());
      expect(result[0]).toEqual({ industryId: null, industryName: undefined, exposure: 100, percent: 100 });
    });

    it('sollte industryName=undefined liefern, wenn die Branchen-ID nicht im Namen-Map auflösbar ist', () => {
      const aggregate = EtoroAggregatePortfolioResponseSchema.parse({
        instrumentAggregates: [{ instrumentId: 1001, netCurrentExposureAccountCurrency: 100 }],
      });
      const result = selectSectorExposure(aggregate, new Map([[1001, 99]]), new Map());
      expect(result[0].industryId).toBe(99);
      expect(result[0].industryName).toBeUndefined();
    });

    it('sollte [] liefern, wenn aggregate undefined ist', () => {
      expect(selectSectorExposure(undefined, new Map(), new Map())).toEqual([]);
    });

    it('sollte percent=0 liefern, wenn die Gesamt-Exposure 0 ist', () => {
      const aggregate = EtoroAggregatePortfolioResponseSchema.parse({
        instrumentAggregates: [{ instrumentId: 1001, netCurrentExposureAccountCurrency: 0 }],
      });
      const result = selectSectorExposure(aggregate, new Map(), new Map());
      expect(result[0].percent).toBe(0);
    });
  });
});

describe('selectFeesPnlBreakdown', () => {
  describe('Normal Behavior', () => {
    it('sollte fees/taxes/pnl je Instrument abbilden, größte |P&L| zuerst', () => {
      const aggregate = EtoroAggregatePortfolioResponseSchema.parse({
        instrumentAggregates: [
          { instrumentId: 1001, totalFeesAcctCcy: 5, totalTaxesAcctCcy: 1, accountCurrencyReturn: -10 },
          { instrumentId: 1002, totalFeesAcctCcy: 2, totalTaxesAcctCcy: 0, accountCurrencyReturn: 50 },
        ],
      });

      const result = selectFeesPnlBreakdown(aggregate);
      expect(result.map((r) => r.instrumentId)).toEqual([1002, 1001]);
      expect(result[0]).toEqual({ instrumentId: 1002, fees: 2, taxes: 0, pnl: 50 });
    });

    it('sollte auf totalFees/totalTaxes zurückfallen, wenn die AcctCcy-Varianten fehlen', () => {
      const aggregate = EtoroAggregatePortfolioResponseSchema.parse({
        instrumentAggregates: [{ instrumentId: 1001, totalFees: 3, totalTaxes: 1 }],
      });
      const [entry] = selectFeesPnlBreakdown(aggregate);
      expect(entry.fees).toBe(3);
      expect(entry.taxes).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('sollte [] liefern, wenn aggregate undefined ist', () => {
      expect(selectFeesPnlBreakdown(undefined)).toEqual([]);
    });

    it('sollte 0 liefern für fehlende fees/taxes/pnl-Felder', () => {
      const aggregate = EtoroAggregatePortfolioResponseSchema.parse({
        instrumentAggregates: [{ instrumentId: 1001 }],
      });
      const [entry] = selectFeesPnlBreakdown(aggregate);
      expect(entry).toEqual({ instrumentId: 1001, fees: 0, taxes: 0, pnl: 0 });
    });
  });
});

describe('selectFeesPnlTotals', () => {
  it('sollte fees/taxes/pnl über alle Instrumente summieren', () => {
    const totals = selectFeesPnlTotals([
      { instrumentId: 1, fees: 5, taxes: 1, pnl: -10 },
      { instrumentId: 2, fees: 2, taxes: 0, pnl: 50 },
    ]);
    expect(totals).toEqual({ totalFees: 7, totalTaxes: 1, totalPnl: 40 });
  });

  it('sollte bei leerer Liste Nullen liefern', () => {
    expect(selectFeesPnlTotals([])).toEqual({ totalFees: 0, totalTaxes: 0, totalPnl: 0 });
  });
});
