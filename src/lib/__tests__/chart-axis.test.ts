import { describe, it, expect } from 'vitest';
import { niceDomain, yAxisDomain } from '../chart-axis';

describe('niceDomain', () => {
  it('beginnt nicht zwingend bei 0, wenn Werte eng beieinander liegen', () => {
    const [lower, upper] = niceDomain(4800, 5200);
    expect(lower).toBeGreaterThan(0);
    expect(lower).toBeLessThanOrEqual(4800);
    expect(upper).toBeGreaterThanOrEqual(5200);
  });

  it('schließt die 0 ein, wenn includeZero gesetzt ist', () => {
    const [lower, upper] = niceDomain(4800, 5200, { includeZero: true });
    expect(lower).toBe(0);
    expect(upper).toBeGreaterThanOrEqual(5200);
  });

  it('schließt die 0 auch bei rein negativen Werten ein', () => {
    const [lower, upper] = niceDomain(-5200, -4800, { includeZero: true });
    expect(upper).toBe(0);
    expect(lower).toBeLessThanOrEqual(-5200);
  });

  it('überschreitet die 0 nicht durch Polsterung bei positiven Daten', () => {
    const [lower] = niceDomain(10, 1000);
    expect(lower).toBeGreaterThanOrEqual(0);
  });

  it('polstert flache Serien, damit die Linie nicht am Rand klebt', () => {
    const [lower, upper] = niceDomain(500, 500);
    expect(lower).toBeLessThan(500);
    expect(upper).toBeGreaterThan(500);
  });

  it('liefert runde Grenzen', () => {
    const [lower, upper] = niceDomain(4811, 5237);
    expect(lower % 5).toBe(0);
    expect(upper % 5).toBe(0);
  });

  it('behandelt ungültige Eingaben defensiv', () => {
    expect(niceDomain(NaN, 100)).toEqual([0, 1]);
    expect(niceDomain(0, Infinity)).toEqual([0, 1]);
  });

  it('sortiert vertauschte Grenzen', () => {
    const [lower, upper] = niceDomain(5200, 4800);
    expect(lower).toBeLessThan(upper);
  });
});

describe('yAxisDomain', () => {
  it('liefert ein Recharts-kompatibles Funktions-Tupel', () => {
    const [lowerFn, upperFn] = yAxisDomain();
    expect(lowerFn(4800)).toBeLessThanOrEqual(4800);
    expect(upperFn(5200)).toBeGreaterThanOrEqual(5200);
  });

  it('erzwingt die 0 mit includeZero', () => {
    const [lowerFn] = yAxisDomain({ includeZero: true });
    expect(lowerFn(4800)).toBe(0);
  });
});
