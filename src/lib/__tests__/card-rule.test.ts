import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error — reines JS-Skript ohne Typen; hier bewusst so eingebunden,
// statt scripts/ in die tsconfig zu ziehen.
import { analyzeCardRule } from '../../../scripts/card-rule-core.mjs';

/**
 * WP-8.0 — Die Karten-Regel (AGENTS.md §9) maschinell prüfbar.
 *
 * Bis hierher gab es dazu nur einen **advisory** Claude-Hook: CI sah nie einen
 * Verstoß, und Agenten ohne `.claude/`-Hooks auch nicht. Diese Tests sichern
 * die Prüflogik — und vor allem ihre Grenzen, denn eine Regel mit Fehlalarmen
 * wird abgeschaltet.
 */

const analyze = analyzeCardRule as (path: string, content: string) => {
  violates: boolean;
  reason: string | null;
};

const CARD_WITHOUT_ACTION = `
  export function Foo() {
    return <Card><CardContent>Nur Text</CardContent></Card>;
  }
`;

describe('analyzeCardRule (WP-8.0)', () => {
  it('sollte Karten-Chrome ohne Klick-Aktion melden', () => {
    expect(analyze('src/components/Foo.tsx', CARD_WITHOUT_ACTION).violates).toBe(true);
  });

  it('sollte eine klickbare Karte durchlassen', () => {
    const content = `
      export function Foo() {
        return <Card onClick={go}><CardContent>Text</CardContent></Card>;
      }
    `;
    expect(analyze('src/components/Foo.tsx', content).violates).toBe(false);
  });

  it('sollte den karten-losen Readout-Baustein durchlassen', () => {
    // Reine Info OHNE Follow-up gehoert ohne Karte dargestellt — genau dafuer
    // gibt es InfoGroup/InfoStatStrip.
    const content = `
      export function Foo() {
        return <><Card /><InfoStatStrip items={[]} /></>;
      }
    `;
    expect(analyze('src/components/Foo.tsx', content).violates).toBe(false);
  });

  it('sollte Dialoge, Formulare und Chart-Rahmen ausnehmen', () => {
    // Die Grenze der Regel: Solche Rahmen versprechen kein Weiterkommen durch
    // Antippen, sie begrenzen einen Inhalt, der schon da ist.
    for (const container of ['<DialogContent>', '<form>', '<ResponsiveContainer>']) {
      const content = `export function Foo() { return <Card>${container}</Card>; }`;
      expect(analyze('src/components/Foo.tsx', content).violates, container).toBe(false);
    }
  });

  it('sollte Tests und Baustein-Definitionen nicht pruefen', () => {
    // Die Primitive selbst DEFINIEREN die Karte, sie benutzen sie nicht.
    expect(analyze('src/components/__tests__/Foo.test.tsx', CARD_WITHOUT_ACTION).violates).toBe(
      false,
    );
    expect(analyze('src/components/ui/card.tsx', CARD_WITHOUT_ACTION).violates).toBe(false);
    expect(
      analyze('src/components/common/InteractiveCard.tsx', CARD_WITHOUT_ACTION).violates,
    ).toBe(false);
  });

  it('sollte Dateien ohne Karten-Chrome nicht anfassen', () => {
    expect(analyze('src/components/Foo.tsx', 'export const x = 1;').violates).toBe(false);
  });

  it('sollte einen Grund mitliefern, wenn es meldet', () => {
    // Ein Fehlschlag ohne Begruendung schickt den naechsten Entwickler ins
    // Raten — und Raten endet meist bei "in die Ausnahmeliste damit".
    const { reason } = analyze('src/components/Foo.tsx', CARD_WITHOUT_ACTION);
    expect(reason).toContain('InteractiveCard');
    expect(reason).toContain('InfoGroup');
  });
});

describe('Ausnahmeliste als Phase-8-Backlog', () => {
  const allowlist = JSON.parse(
    readFileSync(resolve(__dirname, '../../../card-rule-allowlist.json'), 'utf8'),
  ) as { files: string[] };

  it('sollte nur bestehende Dateien auflisten', () => {
    // Ein Eintrag auf eine geloeschte Datei bliebe fuer immer stehen und
    // taeuschte offene Arbeit vor, die es nicht mehr gibt.
    for (const file of allowlist.files) {
      expect(() => readFileSync(resolve(__dirname, '../../..', file)), file).not.toThrow();
    }
  });

  it('sollte keine Doppeleintraege enthalten', () => {
    expect(new Set(allowlist.files).size).toBe(allowlist.files.length);
  });

  it('sollte sortiert sein, damit der Diff lesbar bleibt', () => {
    expect([...allowlist.files].sort()).toEqual(allowlist.files);
  });
});
