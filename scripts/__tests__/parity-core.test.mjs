/**
 * Plattform-Parität, der maschinell prüfbare Teil (AGENTS.md §4).
 *
 * Der Wächter hatte bis zur Mobil-Überarbeitung keinen eigenen Test und las
 * den **rohen** Quelltext. Damit war ein erklärender Satz ein Befund: Die
 * Coach-Fläche wurde gemeldet, weil ihr Kopfkommentar `hidden lg:block`
 * ZITIERTE — ausgerechnet die Klasse, die dort gerade abgeschafft worden war.
 * Ein Wächter, den man durch Dokumentieren auslöst, erzieht zum Schweigen.
 *
 * Der Fund hatte eine zweite Hälfte: In `TransactionsDetailAside.tsx` stand
 * dieselbe Klasse ebenfalls nur noch im Kommentar, und ein Eintrag in
 * `platform-parity-allowlist.json` hielt den Phantom-Befund am Leben. Nach der
 * Korrektur meldete der Wächter den Eintrag selbst als veraltet.
 */

import { describe, it, expect } from 'vitest';
import { unpairedBreakpoints, analyzeParity, isExemptFile } from '../parity-core.mjs';

describe('unpairedBreakpoints', () => {
  it('sollte eine Fläche ohne Gegenstück melden', () => {
    const quelle = `<div className="hidden lg:block">Nur breit</div>`;
    expect(unpairedBreakpoints(quelle)).toEqual(['lg']);
  });

  it('sollte ein Paar in derselben Datei durchgehen lassen', () => {
    const quelle = `
      <div className="hidden lg:block">Tabelle</div>
      <div className="lg:hidden">Kartenliste</div>
    `;
    expect(unpairedBreakpoints(quelle)).toEqual([]);
  });

  it('[REGRESSION] sollte einen Block-Kommentar nicht als Fläche zählen', () => {
    // Genau der Fall aus CoachPage.tsx: Der Kommentar erklärt, dass die
    // Klasse ABGESCHAFFT wurde — und löste damit den Wächter aus.
    const quelle = `
      /**
       * Vorher standen beide Fassungen im Baum und eine wurde per
       * \`hidden lg:block\` weggeblendet.
       */
      export default function Flaeche() { return <div />; }
    `;
    expect(unpairedBreakpoints(quelle)).toEqual([]);
  });

  it('[REGRESSION] sollte einen Zeilenkommentar nicht als Fläche zählen', () => {
    const quelle = `
      // frueher: <div className="hidden md:flex" />
      <div className="flex" />
    `;
    expect(unpairedBreakpoints(quelle)).toEqual([]);
  });

  it('sollte echte Klassen neben einem Kommentar weiterhin sehen', () => {
    // Gegenprobe: Das Ausblenden der Kommentare darf den Wächter nicht
    // blind machen — sonst tauscht man einen Fehlalarm gegen ein Schweigen.
    const quelle = `
      // Hinweis: hier stand einmal lg:hidden
      <div className="hidden lg:block">Nur breit</div>
    `;
    expect(unpairedBreakpoints(quelle)).toEqual(['lg']);
  });

  it('sollte eine reine Gestaltungsänderung nicht als Weiche lesen', () => {
    // `hidden md:opacity-50` blendet nichts ein — die Fläche bleibt versteckt.
    expect(unpairedBreakpoints(`<div className="hidden md:opacity-50" />`)).toEqual([]);
  });
});

describe('analyzeParity', () => {
  it('sollte Tests und UI-Primitive auslassen', () => {
    const quelle = `<div className="hidden lg:block" />`;
    expect(isExemptFile('src/components/ui/sheet.tsx')).toBe(true);
    expect(analyzeParity('src/components/ui/sheet.tsx', quelle).violates).toBe(false);
    expect(analyzeParity('src/pages/__tests__/Foo.test.tsx', quelle).violates).toBe(false);
  });

  it('sollte den Befund benennen statt nur zu melden', () => {
    const ergebnis = analyzeParity('src/pages/Foo.tsx', `<div className="hidden lg:block" />`);
    expect(ergebnis.violates).toBe(true);
    expect(ergebnis.breakpoints).toEqual(['lg']);
    expect(ergebnis.reason).toContain('lg:hidden');
  });
});
