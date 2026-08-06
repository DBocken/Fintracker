import { describe, it, expect } from 'vitest';
import { niceDomain, niceTicks, yAxisDomain } from '../chart-axis';

describe('niceTicks', () => {
  // Befund D-1 aus dem WP-4.6-Critic-Review: Die Y-Achse des
  // Kontostand-Verlaufs zeigte 3500/2695/1795/895/-5 — Recharts errechnet
  // innere Ticks aus dem Datenbereich, statt sie auf runde Schritte zu legen.
  it('[REGRESSION] legt die Ticks des Kontostand-Verlaufs auf runde Schritte', () => {
    expect(niceTicks(0, 3500)).toEqual([0, 1000, 2000, 3000, 4000]);
  });

  it('deckt den Datenbereich vollständig ab, alle Ticks auf der Schrittweite', () => {
    const ticks = niceTicks(-250, 3500);
    expect(ticks[0]).toBeLessThanOrEqual(-250);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(3500);
    const step = ticks[1] - ticks[0];
    for (const tick of ticks) {
      expect(Math.abs(tick % step)).toBe(0);
    }
  });

  it('hält die Tick-Anzahl im Leserahmen', () => {
    const ranges: Array<[number, number]> = [
      [0, 37],
      [0, 3500],
      [-1200, 900],
      [12, 18],
      [0, 999999],
    ];
    for (const [min, max] of ranges) {
      const ticks = niceTicks(min, max);
      expect(ticks.length).toBeGreaterThanOrEqual(3);
      expect(ticks.length).toBeLessThanOrEqual(8);
    }
  });

  it('erzwingt die 0 mit includeZero', () => {
    expect(niceTicks(500, 3500, { includeZero: true })).toContain(0);
  });

  it('behandelt ungültige und flache Bereiche defensiv', () => {
    expect(niceTicks(NaN, 100)).toEqual([0, 1]);
    expect(niceTicks(0, Infinity)).toEqual([0, 1]);
    const flat = niceTicks(1200, 1200);
    expect(flat.length).toBeGreaterThanOrEqual(2);
    expect(flat[0]).toBeLessThanOrEqual(1200);
    expect(flat[flat.length - 1]).toBeGreaterThanOrEqual(1200);
  });

  it('sortiert vertauschte Grenzen', () => {
    const ticks = niceTicks(3500, 0);
    expect(ticks[0]).toBeLessThan(ticks[ticks.length - 1]);
  });
});

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
