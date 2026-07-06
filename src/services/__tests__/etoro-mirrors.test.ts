import { describe, it, expect } from 'vitest';
import { EtoroAggregatePortfolioResponseSchema } from '../etoro-api-schemas';
import { selectEtoroMirrors, selectMirrorTotals, sumMirrorLiquidationValue } from '../etoro-mirrors';

describe('selectEtoroMirrors', () => {
  describe('Normal Behavior', () => {
    it('sollte investedNet/value/pnl aus mirrorTotals ableiten und pnlPercent-Faktor ×100 rechnen', () => {
      // Live-Spec-Beispiel (v1.291.0): mirrorPositionsPnl=-75.05,
      // mirrorLiquidationValue=209.08, mirrorPositionsPnlPercent=-0.35 (Faktor).
      const aggregate = EtoroAggregatePortfolioResponseSchema.parse({
        mirrors: [
          {
            mirrorId: 42,
            mirrorClosedPositionsPnl: 0,
            mirrorTotals: {
              mirrorNetFunding: 214.5,
              mirrorPositionsPnl: -75.05,
              mirrorLiquidationValue: 209.08,
              mirrorPositionsPnlPercent: -0.35,
            },
            instrumentAggregates: [{ instrumentId: 1001 }, { instrumentId: 1002 }],
          },
        ],
      });

      const [mirror] = selectEtoroMirrors(aggregate);
      expect(mirror.mirrorId).toBe(42);
      expect(mirror.investedNet).toBe(214.5);
      expect(mirror.value).toBe(209.08);
      expect(mirror.pnl).toBe(-75.05);
      // Faktor -0.35 → -35%, nicht -0.35%
      expect(mirror.pnlPercent).toBeCloseTo(-35, 5);
      expect(mirror.instrumentIds).toEqual([1001, 1002]);
    });

    it('sollte mirrorClosedPositionsPnl zum offenen G/V addieren', () => {
      const aggregate = EtoroAggregatePortfolioResponseSchema.parse({
        mirrors: [
          {
            mirrorId: 7,
            mirrorClosedPositionsPnl: 20,
            mirrorTotals: {
              mirrorPositionsPnl: 30,
              mirrorLiquidationValue: 100,
            },
          },
        ],
      });

      const [mirror] = selectEtoroMirrors(aggregate);
      expect(mirror.pnl).toBe(50);
    });
  });

  describe('Edge Cases', () => {
    it('sollte bei fehlendem mirrorTotals auf mirrorDepositTotal - mirrorWithdrawalTotal zurückfallen', () => {
      const aggregate = EtoroAggregatePortfolioResponseSchema.parse({
        mirrors: [
          {
            mirrorId: 5,
            mirrorDepositTotal: 500,
            mirrorWithdrawalTotal: 120,
          },
        ],
      });

      const [mirror] = selectEtoroMirrors(aggregate);
      expect(mirror.investedNet).toBe(380);
      expect(mirror.value).toBe(0);
      expect(mirror.pnl).toBe(0);
      expect(mirror.pnlPercent).toBe(0);
      expect(mirror.instrumentIds).toEqual([]);
    });

    it('sollte pnlPercent aus pnl/investedNet ableiten, wenn mirrorPositionsPnlPercent fehlt', () => {
      const aggregate = EtoroAggregatePortfolioResponseSchema.parse({
        mirrors: [
          {
            mirrorId: 9,
            mirrorTotals: {
              mirrorNetFunding: 200,
              mirrorPositionsPnl: 50,
            },
          },
        ],
      });

      const [mirror] = selectEtoroMirrors(aggregate);
      expect(mirror.pnlPercent).toBeCloseTo(25, 5); // 50/200*100
    });

    it('sollte pnlPercent=0 liefern, wenn investedNet=0 und mirrorPositionsPnlPercent fehlt', () => {
      const aggregate = EtoroAggregatePortfolioResponseSchema.parse({
        mirrors: [{ mirrorId: 3 }],
      });

      const [mirror] = selectEtoroMirrors(aggregate);
      expect(mirror.pnlPercent).toBe(0);
    });

    it('sollte [] liefern, wenn keine mirrors vorhanden sind', () => {
      const aggregate = EtoroAggregatePortfolioResponseSchema.parse({ mirrors: [] });
      expect(selectEtoroMirrors(aggregate)).toEqual([]);
    });

    it('sollte [] liefern, wenn aggregate undefined ist', () => {
      expect(selectEtoroMirrors(undefined)).toEqual([]);
    });
  });
});

describe('selectMirrorTotals', () => {
  it('sollte Wert/Netto-Einzahlung/G-V über alle Mirrors summieren', () => {
    const totals = selectMirrorTotals([
      { mirrorId: 1, investedNet: 100, value: 120, pnl: 20, pnlPercent: 20, instrumentIds: [] },
      { mirrorId: 2, investedNet: 50, value: 40, pnl: -10, pnlPercent: -20, instrumentIds: [] },
    ]);
    expect(totals).toEqual({ totalValue: 160, totalNetFunding: 150, totalPnl: 10 });
  });

  it('sollte bei leerer Liste Nullen liefern', () => {
    expect(selectMirrorTotals([])).toEqual({ totalValue: 0, totalNetFunding: 0, totalPnl: 0 });
  });
});

describe('sumMirrorLiquidationValue', () => {
  it('sollte Σ mirrorLiquidationValue über alle Mirrors liefern', () => {
    const aggregate = EtoroAggregatePortfolioResponseSchema.parse({
      mirrors: [
        { mirrorId: 1, mirrorTotals: { mirrorLiquidationValue: 100 } },
        { mirrorId: 2, mirrorTotals: { mirrorLiquidationValue: 50 } },
      ],
    });
    expect(sumMirrorLiquidationValue(aggregate)).toBe(150);
  });

  it('sollte 0 liefern, wenn aggregate undefined ist', () => {
    expect(sumMirrorLiquidationValue(undefined)).toBe(0);
  });
});
