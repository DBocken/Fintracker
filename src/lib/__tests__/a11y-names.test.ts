import { describe, it, expect } from 'vitest';
// @ts-expect-error — reines JS-Skript ohne Typen; hier bewusst so eingebunden,
// statt scripts/ in die tsconfig zu ziehen.
import { analyzeAccessibleNames, findTags } from '../../../scripts/a11y-name-core.mjs';

/**
 * WP-10.2 — „Jedes Bedienelement hat einen Namen."
 *
 * Der Befund, der diesen Wächter ausgelöst hat: Der axe-Durchlauf über alle
 * Screens fand acht namenlose Auswahlfelder, die Quelle enthielt 48. Der
 * Unterschied sind Dialoge und Sheets, die ein Durchlauf ohne Klickpfad nie
 * öffnet — deshalb prüft dieser Wächter die Quelle und nicht das gerenderte
 * Bild.
 */

const analyze = analyzeAccessibleNames as (
  path: string,
  content: string,
) => { violations: { line: number; kind: string }[] };

const tags = findTags as (
  content: string,
  tag: string,
) => { line: number; attrs: string; selfClosing: boolean }[];

describe('findTags', () => {
  it('sollte ein Tag ueber mehrere Zeilen zusammenhalten', () => {
    const found = tags('<Button\n  variant="ghost"\n  size="sm"\n>', 'Button');
    expect(found).toHaveLength(1);
    expect(found[0].attrs).toContain('variant="ghost"');
  });

  it('[REGRESSION] sollte sich von einem `>` in einem Ausdruck nicht taeuschen lassen', () => {
    // `className={cn(a > b && "x")}` — ein naiver Regex bis zum ersten `>`
    // schneidet hier mitten im Attribut ab und haelt das Tag fuer namenlos.
    const found = tags('<SelectTrigger className={cn(count > 3 && "x")} aria-label="Y" />', 'SelectTrigger');
    expect(found[0].attrs).toContain('aria-label="Y"');
  });

  it('sollte nicht auf einen laengeren Bezeichner anspringen', () => {
    // `<SelectTriggerGroup>` ist ein anderes Element.
    expect(tags('<SelectTriggerGroup />', 'SelectTrigger')).toHaveLength(0);
  });
});

describe('analyzeAccessibleNames', () => {
  it('[REGRESSION] sollte ein Auswahlfeld ohne Namen melden', () => {
    // Woertlich das Muster aus dem axe-Befund auf /debts, /contracts, /premium,
    // /csv und /settings.
    const content = '<SelectTrigger className="w-full">\n  <SelectValue />\n</SelectTrigger>';
    expect(analyze('src/pages/X.tsx', content).violations).toEqual([{ line: 1, kind: 'select-trigger' }]);
  });

  it.each(['aria-label={t("x")}', 'aria-labelledby="y"', 'title="z"'])(
    'sollte `%s` als Namen anerkennen',
    (attr) => {
      expect(analyze('src/pages/X.tsx', `<SelectTrigger ${attr}></SelectTrigger>`).violations).toEqual([]);
    },
  );

  it('sollte eine Schaltflaeche melden, deren einziger Inhalt ein Icon ist', () => {
    const content = '<Button variant="ghost">\n  <Trash2 className="h-4 w-4" />\n</Button>';
    expect(analyze('src/pages/X.tsx', content).violations).toEqual([{ line: 1, kind: 'icon-button' }]);
  });

  it('sollte eine Schaltflaeche mit Text in Ruhe lassen', () => {
    const content = '<Button>\n  <Trash2 className="h-4 w-4" />\n  Loeschen\n</Button>';
    expect(analyze('src/pages/X.tsx', content).violations).toEqual([]);
  });

  it('sollte `asChild` nicht melden', () => {
    // Dann rendert das Kind das Element und traegt auch den Namen.
    const content = '<Button asChild>\n  <Link to="/x" />\n</Button>';
    expect(analyze('src/pages/X.tsx', content).violations).toEqual([]);
  });

  it('sollte Tests und die shadcn-Bausteine auslassen', () => {
    const content = '<SelectTrigger className="w-full"></SelectTrigger>';
    expect(analyze('src/components/__tests__/X.test.tsx', content).violations).toEqual([]);
    // `src/components/ui/select.tsx` DEFINIERT den Trigger — dort waere ein
    // fester Name genau falsch.
    expect(analyze('src/components/ui/select.tsx', content).violations).toEqual([]);
  });
});

describe('Bestand', () => {
  it('sollte im gesamten src-Baum ohne Befund durchlaufen', async () => {
    // Kein Backlog, keine Ausnahmeliste: Ein Bedienelement ohne Namen ist mit
    // Screenreader schlicht nicht bedienbar. Dieser Test haelt den Nullstand.
    const { readFileSync, readdirSync } = await import('node:fs');
    const { join, resolve, relative } = await import('node:path');
    const root = resolve(__dirname, '../../..');

    const collect = (dir: string, out: string[] = []): string[] => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
          collect(full, out);
        } else if (entry.name.endsWith('.tsx')) out.push(full);
      }
      return out;
    };

    const findings: string[] = [];
    for (const file of collect(join(root, 'src'))) {
      const rel = relative(root, file).split('\\').join('/');
      for (const violation of analyze(rel, readFileSync(file, 'utf8')).violations) {
        findings.push(`${rel}:${violation.line} (${violation.kind})`);
      }
    }

    expect(findings).toEqual([]);
  });
});
