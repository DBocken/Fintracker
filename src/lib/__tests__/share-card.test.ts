import { describe, it, expect } from 'vitest';
import { buildShareCardData } from '../share-card';
import type { IncomeStream, IncomeStreamsResult } from '../income-streams';

function stream(key: string, total: number): IncomeStream {
  return {
    key, label: key, counterparty: key, mainCategoryId: null, mainCategoryName: '',
    isSalary: false, cadence: 'regelmaessig', monthlyAverage: total / 12, totalInWindow: total,
    lastDateISO: '2024-12-01', lastAmount: total / 12, monthsActive: 12, trend: 'flat',
    confidence: 0.9, share: 0, transactionCount: 12, nextDateISO: null, nextAmount: null, monthlyTotals: {},
  };
}

function result(streams: IncomeStream[]): IncomeStreamsResult {
  const totalIncome = streams.reduce((s, x) => s + x.totalInWindow, 0);
  const largestShare = streams.length ? Math.max(...streams.map((s) => s.totalInWindow)) / (totalIncome || 1) : 0;
  return {
    streams, totalIncome, largestShare,
    diversification: largestShare > 0.75 ? 'concentrated' : largestShare > 0.4 ? 'moderate' : 'diversified',
    windowMonths: 12,
  };
}

describe('buildShareCardData', () => {
  it('bildet eine einfache Verteilung 50/30/20 ohne Sonstige-Slice ab', () => {
    const data = buildShareCardData(result([stream('a', 5000), stream('b', 3000), stream('c', 2000)]));
    expect(data.hasData).toBe(true);
    expect(data.slices.map((s) => s.percent)).toEqual([50, 30, 20]);
    expect(data.slices.some((s) => s.isOther)).toBe(false);
    expect(data.slices.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
  });

  it('bündelt Ströme jenseits der Top-4 in einen Sonstige-Slice', () => {
    const streams = Array.from({ length: 7 }, (_, i) => stream(`s${i}`, 1000 - i * 10));
    const data = buildShareCardData(result(streams));
    const named = data.slices.filter((s) => !s.isOther);
    const other = data.slices.filter((s) => s.isOther);
    expect(named).toHaveLength(4);
    expect(other).toHaveLength(1);
    expect(data.slices.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
  });

  it('erzwingt eine Prozentsumme von exakt 100 auch bei Rundungsfällen (3× ⅓)', () => {
    const data = buildShareCardData(result([stream('a', 1000), stream('b', 1000), stream('c', 1000)]));
    expect(data.slices.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
  });

  it('liefert hasData:false ohne Einnahmen', () => {
    const data = buildShareCardData(result([]));
    expect(data.hasData).toBe(false);
    expect(data.slices).toEqual([]);
  });

  it('[REGRESSION] sollte im Datenmodell keine absoluten Beträge enthalten', () => {
    const data = buildShareCardData(result([stream('a', 3000), stream('b', 2000)]));
    const serialized = JSON.stringify(data);
    // Keine Fixture-Beträge (3000/2000/5000) oder Monatsschnitte im Datenmodell.
    expect(serialized).not.toMatch(/3000|2000|5000|250|166/);
  });
});
