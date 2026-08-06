import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * WP-6.8 — Wächter gegen die Rückkehr der Abschriften.
 *
 * Die Standardisierung selbst ist eine Einmal-Aufräumung; ohne Wächter wäre
 * sie in drei Monaten wieder zerfallen, weil der nächste Chart per
 * Copy-Paste aus dem übernächsten entsteht. Genau so sind die bisherigen
 * Abweichungen entstanden — `hsl(var(--background))` gegen `var(--background)`
 * gegen `hsl(var(--card))` in drei Charts, die alle „denselben" Tooltip
 * zeigen wollten.
 *
 * Geprüft wird die Quelle, nicht das Rendering: ein gerenderter Recharts-
 * Tooltip erscheint erst bei Hover-Interaktion und wäre in jsdom ein
 * ungleich sprödere Nachweis als der Blick in den Quelltext.
 */

const SRC = resolve(__dirname, '../..');

function collectTsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      collectTsxFiles(full, out);
    } else if (entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/** Alle Dateien, die einen Recharts-`<Tooltip>` verwenden. */
function chartFiles(): { path: string; source: string }[] {
  return collectTsxFiles(SRC)
    .map((path) => ({ path, source: readFileSync(path, 'utf8') }))
    .filter(({ source }) => source.includes('from \'recharts\'') || source.includes('from "recharts"'))
    .filter(({ source }) => source.includes('<Tooltip'));
}

describe('Chart-Standardisierung (WP-6.8)', () => {
  it('sollte überhaupt Chart-Dateien finden', () => {
    // Gegenprobe: findet die Sammlung nichts, wären alle Zusicherungen unten
    // leer und damit wertlos grün.
    expect(chartFiles().length).toBeGreaterThan(5);
  });

  it('sollte in keinem Chart mehr ein eigenhändiges contentStyle tragen', () => {
    const offenders = chartFiles()
      .filter(({ source }) => /contentStyle=\{\{/.test(source))
      .map(({ path }) => path.replace(SRC, 'src'));

    expect(offenders).toEqual([]);
  });

  it('sollte jeden Tooltip über chartTooltipProps beziehen', () => {
    const offenders = chartFiles()
      .filter(({ source }) => !source.includes('chartTooltipProps'))
      .map(({ path }) => path.replace(SRC, 'src'));

    expect(offenders).toEqual([]);
  });

  it('sollte keine Zeitstempel als SVG-Gradient-ID verwenden', () => {
    // `id={`fill-${Date.now()}`}` erzeugt bei JEDEM Render eine neue ID — die
    // alten `<defs>` bleiben im Dokument stehen — und kollidiert, sobald zwei
    // Charts in derselben Millisekunde montieren. Richtig ist `useId()`.
    const offenders = chartFiles()
      .filter(({ source }) => /id=[`'"][^`'"]*\$\{Date\.now\(\)\}/.test(source))
      .map(({ path }) => path.replace(SRC, 'src'));

    expect(offenders).toEqual([]);
  });
});
