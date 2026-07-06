import { describe, it, expect } from 'vitest';
import { EtoroTradeHistoryResponseSchema, EtoroPnlResponseSchema, EtoroCashAccountTransactionsResponseSchema } from '../etoro-api-schemas';
import {
  selectClosedTrades,
  selectClosedTradesTotals,
  selectAccountPnl,
  selectCashMovements,
  selectCashMovementsTotals,
} from '../etoro-history';

describe('selectClosedTrades', () => {
  describe('Normal Behavior', () => {
    it('sollte Trades nach closeTimestamp absteigend sortieren (neuester zuerst)', () => {
      const tradeHistory = EtoroTradeHistoryResponseSchema.parse([
        { positionId: 1, instrumentId: 1001, closeTimestamp: '2026-01-01T00:00:00Z', netProfit: 10 },
        { positionId: 2, instrumentId: 1002, closeTimestamp: '2026-06-01T00:00:00Z', netProfit: 20 },
        { positionId: 3, instrumentId: 1003, closeTimestamp: '2026-03-01T00:00:00Z', netProfit: -5 },
      ]);

      const trades = selectClosedTrades(tradeHistory);
      expect(trades.map((t) => t.positionId)).toEqual([2, 3, 1]);
    });

    it('sollte alle relevanten Felder auf das UI-Shape abbilden', () => {
      const tradeHistory = EtoroTradeHistoryResponseSchema.parse([
        {
          positionId: 42,
          instrumentId: 1001,
          isBuy: true,
          leverage: 2,
          openTimestamp: '2026-01-01T00:00:00Z',
          closeTimestamp: '2026-02-01T00:00:00Z',
          openRate: 100,
          closeRate: 110,
          investment: 500,
          fees: 2.5,
          netProfit: 47.5,
        },
      ]);

      const [trade] = selectClosedTrades(tradeHistory);
      expect(trade).toEqual({
        positionId: 42,
        instrumentId: 1001,
        isBuy: true,
        leverage: 2,
        openTimestamp: '2026-01-01T00:00:00Z',
        closeTimestamp: '2026-02-01T00:00:00Z',
        openRate: 100,
        closeRate: 110,
        investment: 500,
        fees: 2.5,
        netProfit: 47.5,
      });
    });
  });

  describe('Edge Cases', () => {
    it('sollte netProfit=0 liefern, wenn netProfit fehlt', () => {
      const tradeHistory = EtoroTradeHistoryResponseSchema.parse([{ positionId: 1, instrumentId: 1001 }]);
      const [trade] = selectClosedTrades(tradeHistory);
      expect(trade.netProfit).toBe(0);
    });

    it('sollte Trades ohne closeTimestamp ans Ende sortieren', () => {
      const tradeHistory = EtoroTradeHistoryResponseSchema.parse([
        { positionId: 1, instrumentId: 1001 },
        { positionId: 2, instrumentId: 1002, closeTimestamp: '2026-01-01T00:00:00Z' },
      ]);

      const trades = selectClosedTrades(tradeHistory);
      expect(trades.map((t) => t.positionId)).toEqual([2, 1]);
    });

    it('sollte [] liefern, wenn tradeHistory undefined ist', () => {
      expect(selectClosedTrades(undefined)).toEqual([]);
    });

    it('sollte [] liefern, wenn tradeHistory leer ist', () => {
      expect(selectClosedTrades([])).toEqual([]);
    });
  });
});

describe('selectClosedTradesTotals', () => {
  it('sollte Anzahl, Σ netProfit und Σ fees über alle Trades summieren', () => {
    const totals = selectClosedTradesTotals([
      {
        positionId: 1,
        instrumentId: 1001,
        isBuy: true,
        leverage: 1,
        openTimestamp: undefined,
        closeTimestamp: undefined,
        openRate: undefined,
        closeRate: undefined,
        investment: undefined,
        fees: 2,
        netProfit: 10,
      },
      {
        positionId: 2,
        instrumentId: 1002,
        isBuy: false,
        leverage: 1,
        openTimestamp: undefined,
        closeTimestamp: undefined,
        openRate: undefined,
        closeRate: undefined,
        investment: undefined,
        fees: undefined,
        netProfit: -5,
      },
    ]);

    expect(totals).toEqual({ count: 2, totalNetProfit: 5, totalFees: 2 });
  });

  it('sollte bei leerer Liste Nullen liefern', () => {
    expect(selectClosedTradesTotals([])).toEqual({ count: 0, totalNetProfit: 0, totalFees: 0 });
  });
});

describe('selectAccountPnl', () => {
  describe('Normal Behavior', () => {
    it('sollte credit/bonusCredit/unrealizedPnl direkt übernehmen und Mirror-G/V summieren', () => {
      const pnl = EtoroPnlResponseSchema.parse({
        clientPortfolio: {
          credit: 10000.5,
          bonusCredit: 500,
          unrealizedPnL: 251,
          mirrors: [
            { mirrorID: 1, closedPositionsNetProfit: 350.75 },
            { mirrorID: 2, closedPositionsNetProfit: -50.25 },
          ],
        },
      });

      const view = selectAccountPnl(pnl);
      expect(view).toEqual({
        credit: 10000.5,
        bonusCredit: 500,
        unrealizedPnl: 251,
        mirrorsRealizedPnl: 300.5,
      });
    });
  });

  describe('Edge Cases', () => {
    it('sollte alles undefined/0 liefern, wenn pnl undefined ist', () => {
      expect(selectAccountPnl(undefined)).toEqual({
        credit: undefined,
        bonusCredit: undefined,
        unrealizedPnl: undefined,
        mirrorsRealizedPnl: 0,
      });
    });

    it('sollte mirrorsRealizedPnl=0 liefern, wenn clientPortfolio.mirrors fehlt', () => {
      const pnl = EtoroPnlResponseSchema.parse({ clientPortfolio: { credit: 100 } });
      expect(selectAccountPnl(pnl).mirrorsRealizedPnl).toBe(0);
    });

    it('sollte Mirrors ohne closedPositionsNetProfit als 0 werten', () => {
      const pnl = EtoroPnlResponseSchema.parse({ clientPortfolio: { mirrors: [{ mirrorID: 1 }] } });
      expect(selectAccountPnl(pnl).mirrorsRealizedPnl).toBe(0);
    });
  });
});

describe('selectCashMovements', () => {
  describe('Normal Behavior', () => {
    it('sollte amount als String in eine Zahl parsen und nach postedAt absteigend sortieren', () => {
      const transactions = EtoroCashAccountTransactionsResponseSchema.parse({
        results: [
          {
            id: '1',
            accountId: 'acc-1',
            transactionType: 'balanceAdjustment',
            transactionSubtype: 'fee',
            direction: 'debit',
            status: 'settled',
            amount: '2.50',
            currency: 'USD',
            postedAt: '2026-06-01T00:00:00Z',
          },
          {
            id: '2',
            accountId: 'acc-1',
            transactionType: 'internalTransfer',
            transactionSubtype: 'transferReceived',
            direction: 'credit',
            status: 'settled',
            amount: '100.00',
            currency: 'USD',
            postedAt: '2026-06-05T00:00:00Z',
            counterparty: { name: 'Jane Doe', type: 'internal_account' },
          },
        ],
        pagination: { pageSize: 50, hasNext: false },
      });

      const movements = selectCashMovements(transactions);
      expect(movements.map((m) => m.id)).toEqual(['2', '1']);
      expect(movements[0].amount).toBe(100);
      expect(movements[0].signedAmount).toBe(100);
      expect(movements[0].counterpartyName).toBe('Jane Doe');
      expect(movements[1].signedAmount).toBe(-2.5);
    });
  });

  describe('Edge Cases', () => {
    it('sollte [] liefern, wenn transactions undefined ist', () => {
      expect(selectCashMovements(undefined)).toEqual([]);
    });

    it('sollte 0 liefern, wenn amount nicht parsbar ist', () => {
      const transactions = EtoroCashAccountTransactionsResponseSchema.parse({
        results: [
          {
            id: '1',
            accountId: 'acc-1',
            transactionType: 'balanceAdjustment',
            transactionSubtype: 'fee',
            direction: 'debit',
            status: 'settled',
            amount: 'not-a-number',
            currency: 'USD',
            postedAt: '2026-06-01T00:00:00Z',
          },
        ],
        pagination: { pageSize: 50, hasNext: false },
      });
      expect(selectCashMovements(transactions)[0].amount).toBe(0);
    });
  });
});

describe('selectCashMovementsTotals', () => {
  it('sollte Anzahl, Σ vorzeichenbehafteten Betrag und Σ Gebühren summieren', () => {
    const totals = selectCashMovementsTotals([
      { id: '1', postedAt: '', subtype: 'fee', direction: 'debit', amount: 2.5, signedAmount: -2.5, currency: 'USD', counterpartyName: undefined },
      { id: '2', postedAt: '', subtype: 'transferReceived', direction: 'credit', amount: 100, signedAmount: 100, currency: 'USD', counterpartyName: undefined },
    ]);
    expect(totals).toEqual({ count: 2, totalSigned: 97.5, totalFees: 2.5 });
  });

  it('sollte bei leerer Liste Nullen liefern', () => {
    expect(selectCashMovementsTotals([])).toEqual({ count: 0, totalSigned: 0, totalFees: 0 });
  });
});
