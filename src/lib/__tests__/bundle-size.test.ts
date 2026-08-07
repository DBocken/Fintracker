import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error — reines JS-Skript ohne Typen; hier bewusst so eingebunden,
// statt scripts/ in die tsconfig zu ziehen.
import { chunkName, compareToBudget, gzipSizeOf } from '../../../scripts/bundle-size-core.mjs';

/**
 * WP-10.6 — Bundle-Budget.
 *
 * Die Menge an JavaScript stand bisher nur als Warnung im Build-Protokoll
 * („Some chunks are larger than 500 kB"). Eine Warnung, die bei jedem Build
 * erscheint, liest nach der dritten Woche niemand mehr.
 */

const name = chunkName as (file: string) => string;
const gzipSize = gzipSizeOf as (content: string | Buffer) => number;
const compare = compareToBudget as (
  measured: Record<string, number>,
  budget: { totalGzipBytes?: number; chunks?: Record<string, number> },
  options?: { slackRatio?: number },
) => {
  over: { name: string }[];
  stale: { name: string }[];
  unbudgeted: { name: string }[];
  total: number;
  totalOver: boolean;
};

describe('chunkName', () => {
  it('[REGRESSION] sollte den Inhalts-Hash abschneiden', () => {
    // Ohne das waere das Budget nach einem einzigen geaenderten Zeichen
    // wertlos: Die Datei hiesse anders und faende ihren Eintrag nicht.
    expect(name('CityPage-sUZgBeGW.js')).toBe('CityPage');
    expect(name('money-taEjb3vW.js')).toBe('money');
    expect(name('jspdf.es.min-DsxPNRBz.js')).toBe('jspdf.es.min');
  });

  it('sollte einen Namen ohne Hash unveraendert lassen', () => {
    expect(name('index.js')).toBe('index');
  });
});

describe('gzipSizeOf', () => {
  it('sollte komprimiert messen, nicht roh', () => {
    // Ausgeliefert wird komprimiert; die rohe Zahl beschreibt niemandes
    // Wartezeit.
    const repetitive = 'a'.repeat(10_000);
    expect(gzipSize(repetitive)).toBeLessThan(repetitive.length / 10);
  });
});

describe('compareToBudget', () => {
  const budget = { totalGzipBytes: 1000, chunks: { alpha: 500, beta: 300 } };

  it('sollte ein gewachsenes Buendel melden', () => {
    const result = compare({ alpha: 600, beta: 100 }, budget);
    expect(result.over.map((e) => e.name)).toEqual(['alpha']);
  });

  it('sollte ein eingehaltenes Budget durchlassen', () => {
    expect(compare({ alpha: 450, beta: 280 }, budget).over).toEqual([]);
  });

  it('sollte ein neues Buendel als solches melden statt es zu uebersehen', () => {
    expect(compare({ gamma: 100 }, budget).unbudgeted.map((e) => e.name)).toEqual(['gamma']);
  });

  it('sollte ein viel zu grosszuegiges Budget melden', () => {
    // Ein Budget, das um ein Vielfaches ueberschritten werden koennte, bevor es
    // anschlaegt, misst nichts mehr.
    expect(compare({ alpha: 100 }, budget).stale.map((e) => e.name)).toEqual(['alpha']);
  });

  it('sollte die Summe getrennt bewerten', () => {
    // Viele kleine Zuwaechse reissen kein Einzelbudget, die Summe schon.
    expect(compare({ alpha: 499, beta: 299 }, { ...budget, totalGzipBytes: 700 }).totalOver).toBe(
      true,
    );
  });
});

describe('Budget-Datei', () => {
  const budget = JSON.parse(
    readFileSync(resolve(__dirname, '../../../bundle-size-budget.json'), 'utf8'),
  ) as { totalGzipBytes: number; chunks: Record<string, number> };

  it('sollte eine Gesamtgrenze fuehren', () => {
    // Sie deckt die rund 130 kleinen Buendel ab, die kein Einzelbudget haben.
    expect(budget.totalGzipBytes).toBeGreaterThan(0);
  });

  it('sollte nur positive Ganzzahlen enthalten', () => {
    for (const [chunk, limit] of Object.entries(budget.chunks)) {
      expect(Number.isInteger(limit), chunk).toBe(true);
      expect(limit, chunk).toBeGreaterThan(0);
    }
  });

  it('sollte die grossen Buendel benennen, die wir kennen', () => {
    // Sicherung gegen ein versehentlich geleertes Budget: Ein leeres
    // `chunks` waere gruen und pruefte nichts.
    expect(Object.keys(budget.chunks).length).toBeGreaterThanOrEqual(10);
    expect(budget.chunks).toHaveProperty('CityPage');
  });
});
