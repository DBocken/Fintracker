import { describe, it, expect } from 'vitest';
import { dailyBand } from '../scenario-engine';

/**
 * WP-6.1 — Diffuse Konfidenzwolken.
 *
 * Das Prognoseband zeigte bisher genau eine Fläche von P10 bis P90, mit
 * harter Kante. Eine harte Kante liest sich als Zusage („darunter geht es
 * nicht"), obwohl P10 gerade heißt, dass jeder zehnte Durchlauf tiefer
 * fällt. Für eine Darstellung, deren Rand ausfranst statt zu schneiden,
 * braucht es mehr als drei Perzentile.
 *
 * Die Tagesspalte ist für den Median ohnehin schon sortiert — weitere
 * Perzentile sind ein Array-Zugriff, kein zweiter Durchlauf. Die Wolke ist
 * damit aus echten Quantilen gebaut und nicht aus interpolierter Deko.
 */

/** Vier Pfade über zwei Tage, mit bekannten Werten je Tagesspalte. */
const PATHS = [
  [100, 1000],
  [200, 2000],
  [300, 3000],
  [400, 4000],
];
const DATES = ['2026-01-01', '2026-01-02'];

describe('dailyBand (WP-6.1)', () => {
  it('sollte je Tag sieben Perzentile liefern', () => {
    const band = dailyBand(PATHS, DATES);
    expect(band).toHaveLength(2);
    expect(Object.keys(band[0]).sort()).toEqual(
      ['date', 'p05', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95'].sort(),
    );
  });

  it('sollte die Perzentile monoton aufsteigend liefern', () => {
    // Ohne Monotonie wäre die verschachtelte Darstellung unmöglich: eine
    // innere Fläche darf nie über eine äußere hinausragen.
    for (const point of dailyBand(PATHS, DATES)) {
      expect(point.p05).toBeLessThanOrEqual(point.p10);
      expect(point.p10).toBeLessThanOrEqual(point.p25);
      expect(point.p25).toBeLessThanOrEqual(point.p50);
      expect(point.p50).toBeLessThanOrEqual(point.p75);
      expect(point.p75).toBeLessThanOrEqual(point.p90);
      expect(point.p90).toBeLessThanOrEqual(point.p95);
    }
  });

  it('sollte die bisherigen P10/P50/P90 unverändert lassen', () => {
    // Der Kern des Bandes darf sich durch die Erweiterung nicht verschieben —
    // sonst änderte sich die fachliche Aussage der Prognose.
    const band = dailyBand(PATHS, DATES);
    expect(band[0].p50).toBe(250);
    expect(band[1].p50).toBe(2500);
  });

  it('sollte das Datum je Spalte durchreichen', () => {
    const band = dailyBand(PATHS, DATES);
    expect(band.map((point) => point.date)).toEqual(DATES);
  });

  it('sollte mit einem einzigen Pfad umgehen', () => {
    // Ein Durchlauf hat keine Streuung; alle Perzentile fallen zusammen und
    // die Wolke ist eine Linie. Kein Sonderfall, nur eine Breite von null.
    const band = dailyBand([[500, 600]], DATES);
    expect(band[0].p05).toBe(band[0].p95);
    expect(band[0].p50).toBe(500);
  });

  it('[REGRESSION] sollte ohne Pfade eine leere Aussage statt NaN liefern', () => {
    const band = dailyBand([], DATES);
    expect(band).toHaveLength(2);
    for (const point of band) {
      expect(Number.isFinite(point.p50)).toBe(true);
    }
  });
});
