import { describe, it, expect } from 'vitest';
import { EtoroHistoricalBalancesResponseSchema, EtoroBalancesResponseSchema } from '../etoro-api-schemas';
import { selectPerformanceSeries, selectPerformanceTrend, selectCashAccountId } from '../etoro-performance';

describe('selectPerformanceSeries', () => {
  describe('Normal Behavior', () => {
    it('sollte Snapshots chronologisch aufsteigend sortieren und displayTotalBalance verwenden', () => {
      const history = EtoroHistoricalBalancesResponseSchema.parse({
        snapshots: [
          { date: '2026-06-03', totalBalance: 200, displayTotalBalance: 210 },
          { date: '2026-06-01', totalBalance: 100, displayTotalBalance: 110 },
          { date: '2026-06-02', totalBalance: 150, displayTotalBalance: 160 },
        ],
      });

      const series = selectPerformanceSeries(history);
      expect(series.map((p) => p.date)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
      expect(series.map((p) => p.value)).toEqual([110, 160, 210]);
    });

    it('sollte auf totalBalance zurückfallen, wenn displayTotalBalance fehlt', () => {
      const history = EtoroHistoricalBalancesResponseSchema.parse({
        snapshots: [{ date: '2026-06-01', totalBalance: 100 }],
      });
      expect(selectPerformanceSeries(history)[0].value).toBe(100);
    });
  });

  describe('Edge Cases', () => {
    it('sollte [] liefern, wenn history undefined ist', () => {
      expect(selectPerformanceSeries(undefined)).toEqual([]);
    });

    it('sollte 0 liefern, wenn weder totalBalance noch displayTotalBalance vorhanden sind', () => {
      const history = EtoroHistoricalBalancesResponseSchema.parse({ snapshots: [{ date: '2026-06-01' }] });
      expect(selectPerformanceSeries(history)[0].value).toBe(0);
    });
  });
});

describe('selectPerformanceTrend', () => {
  it('sollte "positive" liefern, wenn der letzte Wert höher ist als der erste', () => {
    expect(selectPerformanceTrend([{ date: '1', value: 100 }, { date: '2', value: 150 }])).toBe('positive');
  });

  it('sollte "warning" liefern, wenn der letzte Wert niedriger ist als der erste', () => {
    expect(selectPerformanceTrend([{ date: '1', value: 150 }, { date: '2', value: 100 }])).toBe('warning');
  });

  it('sollte "neutral" liefern, wenn sich der Wert nicht ändert', () => {
    expect(selectPerformanceTrend([{ date: '1', value: 100 }, { date: '2', value: 100 }])).toBe('neutral');
  });

  it('sollte "neutral" liefern, wenn weniger als 2 Datenpunkte vorhanden sind', () => {
    expect(selectPerformanceTrend([])).toBe('neutral');
    expect(selectPerformanceTrend([{ date: '1', value: 100 }])).toBe('neutral');
  });
});

describe('selectCashAccountId', () => {
  it('sollte die accountId des Cash-Kontos liefern', () => {
    const balances = EtoroBalancesResponseSchema.parse({
      balances: [
        { accountId: 'trading-1', accountType: 'Trading' },
        { accountId: 'cash-1', accountType: 'Cash' },
      ],
    });
    expect(selectCashAccountId(balances)).toBe('cash-1');
  });

  it('sollte undefined liefern, wenn kein Cash-Konto vorhanden ist', () => {
    const balances = EtoroBalancesResponseSchema.parse({ balances: [{ accountId: 'trading-1', accountType: 'Trading' }] });
    expect(selectCashAccountId(balances)).toBeUndefined();
  });

  it('sollte undefined liefern, wenn balances undefined ist', () => {
    expect(selectCashAccountId(undefined)).toBeUndefined();
  });
});
