/**
 * Repoweiter Wächter: Ladezustände sprechen eine Sprache.
 *
 * WP-3.4 baute die `shimmer`-Variante („Liquid Loading"), verwendet wurde sie
 * danach an **keiner einzigen** Stelle — 18 von 18 `<Skeleton>` liefen weiter
 * mit dem Standard-Pulse. Das ist dieselbe Klasse wie die Atmosphäre in der
 * AppShell und der Chart-Hook: gebaut, aber nicht angeschlossen. Ein
 * Komponententest der Variante kann das prinzipiell nicht bemerken, weil die
 * Komponente korrekt ist.
 *
 * Der Test liest die QUELLE, nicht das gerenderte Ergebnis: ob eine Datei die
 * Variante setzt, steht im Aufruf, nicht im DOM irgendeines Screens.
 *
 * Bewusst mit Korpus-Zusicherung: ein Wächter, der über eine leere Menge läuft,
 * ist grün und wertlos.
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

/** Alle nicht-Test-TSX-Dateien unter src/, wie git sie kennt. */
function sourceFiles(): string[] {
  // execFileSync mit Argument-Array statt execSync mit String (AGENTS.md §10.1).
  const out = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8', cwd: process.cwd() });
  return out
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((f) => f.endsWith('.tsx'))
    .filter((f) => !f.includes('__tests__') && !/\.(test|spec)\./.test(f))
    // `git ls-files` kennt den Index, nicht die Platte: eine noch nicht
    // eingecheckte Löschung (Umbenennung mitten in einem Refactoring) liegt
    // hier weiterhin drin. Ohne diesen Filter stirbt die Prüfung mit einem
    // ENOENT-Stacktrace statt eine Aussage über die Ladezustände zu treffen —
    // genau so geschehen bei der Slice-Migration in WP 6.3. Derselbe Filter
    // steht aus demselben Grund in `src/i18n/__tests__/call-site-keys.test.ts`
    // und in `scripts/check-view-data.mjs`. Die Korpusgröße bleibt durch die
    // Untergrenze unten abgesichert.
    .filter((f) => existsSync(`${process.cwd()}/${f}`));
}

/** Öffnende `<Skeleton …>`-Tags, auch über mehrere Zeilen. */
const SKELETON_TAG = /<Skeleton\b[^>]*?\/?>/gs;

describe('Skeleton — Ladezustände sprechen eine Sprache', () => {
  const usages = sourceFiles().flatMap((file) => {
    const source = readFileSync(`${process.cwd()}/${file}`, 'utf8');
    return [...source.matchAll(SKELETON_TAG)].map((m) => ({ file, tag: m[0] }));
  });

  it('sollte einen nicht-trivialen Korpus scannen', () => {
    // Ohne diese Zusicherung wäre ein grüner Lauf bedeutungslos: eine kaputte
    // Regex oder ein leerer Dateifilter lieferte still null Treffer.
    expect(usages.length).toBeGreaterThan(10);
  });

  it('[REGRESSION] sollte ueberall die shimmer-Variante verwenden', () => {
    const missing = usages
      .filter((u) => !/variant\s*=\s*["']shimmer["']/.test(u.tag))
      .map((u) => `${u.file}: ${u.tag.replace(/\s+/g, ' ').slice(0, 80)}`);

    expect(missing).toEqual([]);
  });
});
