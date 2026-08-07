import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error — reines JS-Skript ohne Typen; hier bewusst so eingebunden,
// statt scripts/ in die tsconfig zu ziehen.
import { analyzeParity, unpairedBreakpoints } from '../../../scripts/parity-core.mjs';

/**
 * Plattform-Parität (AGENTS.md §4), der maschinell prüfbare Teil.
 *
 * Bis hierher war Parität ausschließlich Sache des Selbst-Reviews — und genau
 * dort ist sie durchgerutscht: Die Export-Reihe der Geldfluss-Visualisierung
 * trug `hidden sm:flex` **ohne Gegenstück**, auf dem Telefon gab es den Export
 * schlicht nicht. Gefunden hat das eine Durchsicht von Hand (WP-8.3); beim
 * nächsten Mal findet es der Build.
 */

const analyze = analyzeParity as (
  path: string,
  content: string,
) => { violates: boolean; breakpoints: string[]; reason: string | null };

const unpaired = unpairedBreakpoints as (content: string) => string[];

describe('unpairedBreakpoints', () => {
  it('sollte eine Weiche ohne Gegenstueck melden', () => {
    expect(unpaired('<div className="hidden sm:flex">Export</div>')).toEqual(['sm']);
  });

  it('sollte eine paarige Weiche durchlassen', () => {
    const content = `
      <div className="hidden sm:flex">Drei Knoepfe</div>
      <button className="sm:hidden">Menue</button>
    `;
    expect(unpaired(content)).toEqual([]);
  });

  it('sollte Breakpoints getrennt betrachten', () => {
    // Ein `md:hidden` rettet kein `hidden lg:block`: Zwischen md und lg ist die
    // Flaeche dann NIRGENDS.
    const content = `
      <div className="hidden lg:block">Seitenspalte</div>
      <div className="md:hidden">Etwas anderes</div>
    `;
    expect(unpaired(content)).toEqual(['lg']);
  });

  it('sollte mehrere unpaarige Breakpoints alle melden', () => {
    const content = '<a className="hidden sm:block" /><b className="hidden lg:flex" />';
    expect(unpaired(content)).toEqual(['sm', 'lg']);
  });

  it('sollte reine Gestaltungsaenderungen nicht als Weiche zaehlen', () => {
    // `hidden md:opacity-50` blendet nichts ein — die Flaeche bleibt versteckt.
    // Wuerde das zaehlen, saehe der Check ueberall Weichen, die keine sind.
    expect(unpaired('<div className="hidden md:opacity-50" />')).toEqual([]);
  });

  it('sollte Dateien ohne jede Weiche nicht anfassen', () => {
    expect(unpaired('<div className="flex gap-2" />')).toEqual([]);
  });
});

describe('analyzeParity', () => {
  it('[REGRESSION] sollte den Sankey-Export-Fall gemeldet haben', () => {
    // Der Ist-Zustand vor WP-8.3, woertlich: drei Export-Knoepfe, die es
    // unterhalb von sm gar nicht gab.
    const before = `
      <div className="hidden sm:flex items-center gap-2">
        <Button onClick={handleExportPNG}>Export PNG</Button>
      </div>
    `;
    const result = analyze('src/components/premium-dashboard/SankeyChart.tsx', before);
    expect(result.violates).toBe(true);
    expect(result.breakpoints).toEqual(['sm']);
  });

  it('sollte den Fix von WP-8.3 durchlassen', () => {
    // Gegenprobe: Ohne sie wuesste man nicht, ob der Test die Regel prueft oder
    // nur die Datei kennt.
    const after = `
      <div className="hidden sm:flex items-center gap-2">
        <Button onClick={handleExportPNG}>Export PNG</Button>
      </div>
      <DropdownMenuTrigger asChild className="sm:hidden"><Button /></DropdownMenuTrigger>
    `;
    expect(analyze('src/components/premium-dashboard/SankeyChart.tsx', after).violates).toBe(false);
  });

  it('sollte einen Grund mitliefern, der auf beide Auswege zeigt', () => {
    // Ein Fehlschlag ohne Begruendung schickt den naechsten Entwickler ins
    // Raten — und Raten endet meist bei "in die Ausnahmeliste damit".
    const { reason } = analyze('src/components/Foo.tsx', '<div className="hidden md:block" />');
    expect(reason).toContain('§4');
    expect(reason).toContain('Nachbardatei');
  });

  it('sollte UI-Primitive und Tests nicht pruefen', () => {
    // Ein `hidden sm:block` in einem Sheet ist Mechanik, keine
    // Produktentscheidung.
    const content = '<div className="hidden sm:block" />';
    expect(analyze('src/components/ui/sheet.tsx', content).violates).toBe(false);
    expect(analyze('src/components/__tests__/Foo.test.tsx', content).violates).toBe(false);
  });
});

describe('Ausnahmeliste als Paar-Register', () => {
  const allowlist = JSON.parse(
    readFileSync(resolve(__dirname, '../../../platform-parity-allowlist.json'), 'utf8'),
  ) as { pairs: Record<string, string> };

  it('sollte nur bestehende Dateien auflisten', () => {
    for (const file of Object.keys(allowlist.pairs)) {
      expect(() => readFileSync(resolve(__dirname, '../../..', file)), file).not.toThrow();
    }
  });

  it('sollte zu JEDEM Eintrag den Partner benennen', () => {
    // Der Kern dieser Liste: Sie ist kein Backlog, sondern ein Register. Ein
    // Eintrag ohne nachweisbaren Partner waere ein verstecktes fehlendes
    // Feature — genau das, was der Check finden soll.
    for (const [file, partner] of Object.entries(allowlist.pairs)) {
      expect(partner.length, file).toBeGreaterThan(40);
      expect(partner, file).toMatch(/\.tsx|useIsWideDesktop/);
    }
  });
});
