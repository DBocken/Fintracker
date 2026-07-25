import { describe, it, expect } from 'vitest';
import { chartNumber, chartText } from '../chart-tooltip';

describe('chartNumber', () => {
  it('sollte Zahlen unverändert durchreichen', () => {
    expect(chartNumber(1234.56)).toBe(1234.56);
    expect(chartNumber(0)).toBe(0);
    expect(chartNumber(-42)).toBe(-42);
  });

  it('sollte numerische Strings umwandeln', () => {
    expect(chartNumber('1234.56')).toBe(1234.56);
    expect(chartNumber('-7')).toBe(-7);
  });

  it('[REGRESSION] sollte den ersten Wert eines Arrays nehmen (Range-Charts liefern [min, max])', () => {
    expect(chartNumber([12, 34])).toBe(12);
  });

  it('sollte nicht-numerische Eingaben zu 0 machen statt NaN in den Tooltip zu schreiben', () => {
    expect(chartNumber(undefined)).toBe(0);
    expect(chartNumber(null)).toBe(0);
    expect(chartNumber('keine Zahl')).toBe(0);
    expect(chartNumber({})).toBe(0);
    expect(chartNumber(Number.NaN)).toBe(0);
    expect(chartNumber(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('chartText', () => {
  it('sollte Strings unverändert durchreichen', () => {
    expect(chartText('Wohnen')).toBe('Wohnen');
  });

  it('sollte Zahlen als String liefern (Recharts gibt Labels auch numerisch)', () => {
    expect(chartText(2026)).toBe('2026');
  });

  it('[REGRESSION] sollte null/undefined zu leerem String machen, nicht zu "null"', () => {
    expect(chartText(null)).toBe('');
    expect(chartText(undefined)).toBe('');
  });
});
