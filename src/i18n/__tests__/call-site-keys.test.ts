import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { translations, DEFAULT_LOCALE } from '../translations';

/**
 * Jeder `t('a.b.c')`-Aufruf muss einen existierenden Key treffen.
 *
 * Das prüft die Locale-Parität ausdrücklich NICHT: sie beweist, dass die drei
 * Sprachbäume zueinander passen — nicht, dass die Aufrufstellen zu den Bäumen
 * passen. Ein vertippter oder nie angelegter Key ist in allen drei Bäumen
 * gleichermaßen abwesend und fällt dort deshalb nicht auf.
 *
 * Genau so ist `replacementPlanService.notFound` in Produktion gelandet: der
 * Namespace existierte nirgends, und weil der Aufruf einen deutschen Fallback
 * mitgab, sahen alle Sprachen still den deutschen Text. Ohne Fallback wäre der
 * rohe Punkt-String auf dem Bildschirm gestanden.
 *
 * `.claude/agents/i18n-enforcer.md` beschreibt diese Prüfung bis heute als
 * „throwaway script", das sich der Agent bei jedem Lauf neu baut. Hier ist sie
 * dauerhaft.
 */

/** Alle nicht-Test-Quelldateien unter src/, wie git sie kennt. */
function sourceFiles(): string[] {
  const out = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8', cwd: process.cwd() });
  return out
    .split('\n')
    .filter(Boolean)
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => !f.includes('__tests__') && !/\.(test|spec)\./.test(f))
    .filter((f) => !f.startsWith('src/test-utils/'))
    // `git ls-files` kennt den Index, nicht die Platte: eine noch nicht
    // eingecheckte Löschung (Umbenennung mitten in einem Refactoring) liegt
    // hier weiterhin drin. Ohne diesen Filter stirbt die Prüfung mit einem
    // ENOENT-Stacktrace statt eine Aussage über i18n zu treffen. Die
    // Korpusgröße bleibt durch die Untergrenze unten abgesichert.
    .filter((f) => existsSync(`${process.cwd()}/${f}`));
}

function resolveKey(key: string): unknown {
  let node: unknown = translations[DEFAULT_LOCALE];
  for (const part of key.split('.')) {
    if (node === undefined || node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/**
 * `t('…')` und der Alias `translate('…')` (src/lib/analysis-data.ts und die
 * `lib/chart-data/`-Module importieren
 * `t as translate`). Nur Literal-Keys — dynamisch gebaute werden separat gezählt.
 */
const LITERAL_CALL = /(?<![\w.])(?:t|translate)\(\s*['"]([a-zA-Z0-9_.]+)['"]/g;
const DYNAMIC_CALL = /(?<![\w.])(?:t|translate)\(\s*(?:`|[a-zA-Z_$][\w$.]*\s*[),?])/g;

describe('i18n-Aufrufstellen', () => {
  const files = sourceFiles();

  it('sollte einen nicht-trivialen Korpus scannen', () => {
    // Sonst wäre ein grüner Lauf bedeutungslos.
    expect(files.length).toBeGreaterThan(200);
  });

  it('[REGRESSION] sollte fuer jeden literalen t()-Key einen Eintrag haben', () => {
    const missing: string[] = [];

    for (const file of files) {
      const source = readFileSync(`${process.cwd()}/${file}`, 'utf8');
      const lines = source.split('\n');
      lines.forEach((line, index) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        for (const match of line.matchAll(LITERAL_CALL)) {
          const key = match[1];
          // Einzelwort-Argumente sind keine i18n-Keys (z. B. `t("de")` gibt es
          // nicht, aber Hilfsfunktionen mit gleichem Namen könnten so aussehen).
          if (!key.includes('.')) continue;
          if (typeof resolveKey(key) !== 'string') missing.push(`${file}:${index + 1} — ${key}`);
        }
      });
    }

    expect(missing).toEqual([]);
  });

  it('sollte die Zahl dynamisch gebauter Keys sichtbar halten', () => {
    // Dynamische Keys (`t(\`nav.items.${id}\`)`, `t(item.labelKey)`) kann dieser
    // Test nicht auflösen — sie sind der blinde Fleck. Die Zahl wird deshalb
    // festgenagelt, damit der Fleck nicht unbemerkt wächst: wer hier vorbei
    // will, muss die Schranke bewusst anheben. Stand beim Einführen: 65.
    //
    // Angehoben auf 77 mit der Tutorial-Übersicht: Bereichs- und
    // Kapitelnamen kommen dort zwangsläufig als Schlüssel aus den Daten
    // (`section.titleKey`, `chapter.titleKey`, `tutorialTitleKey(chapter)`) —
    // dieselbe Bauform wie `nav.items.${id}`. Der blinde Fleck ist hier
    // anderweitig ausgeleuchtet: `tutorial-catalog.test.ts` prüft für JEDES
    // Kapitel mit Schritten, dass `tutorial.<id>.name` in allen Sprachen
    // auflöst, `tutorial-steps.test.ts` dasselbe für die Schritttexte.
    let dynamic = 0;
    for (const file of files) {
      const source = readFileSync(`${process.cwd()}/${file}`, 'utf8');
      dynamic += [...source.matchAll(DYNAMIC_CALL)].length;
    }
    expect(dynamic).toBeLessThanOrEqual(77);
  });
});
