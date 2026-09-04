import { describe, expect, it } from 'vitest';
import { MIN_LESBAR_PX, findeZuKleinenText, istBildschirmtext } from '../type-scale-core.mjs';

/**
 * Wächter gegen unlesbar kleinen Bildschirmtext (AGENTS.md §9, Prinzip 7).
 *
 * Der Befund kam aus einer Messung, nicht aus einer Meinung: 21 Stellen im
 * Baum setzten `text-[10px]`, `text-[9px]`, `text-[8px]`. Prinzip 7 verspricht
 * „Kontrast ausreichend, Tap-Ziele gross genug" — über die Schriftgrösse stand
 * dort nichts, und deshalb hat nie etwas rot gemacht, was auf einem Telefon
 * mit hoher Pixeldichte schlicht nicht mehr zu lesen ist.
 *
 * Beide Richtungen sind festgehalten. Die zweite ist die wichtigere: Ein
 * Wächter, der die 8pt-Fusszeile eines PDF-Exports anmeckert, hätte am ersten
 * Tag Fehlalarm — und ein Wächter mit Fehlalarm wird abgeschaltet statt
 * durchgesetzt (dieselbe Lehre wie bei `check:money-format`).
 */

describe('istBildschirmtext', () => {
  it('sollte Komponenten, Seiten und Slice-Präsentation prüfen', () => {
    expect(istBildschirmtext('src/components/budgets/BudgetTile.tsx')).toBe(true);
    expect(istBildschirmtext('src/pages/DebtsPage.tsx')).toBe(true);
    expect(istBildschirmtext('src/features/dashboard/presentation/mobile/Story.tsx')).toBe(true);
    expect(istBildschirmtext('src/components/ui/badge.tsx')).toBe(true);
  });

  it('sollte Tests nicht prüfen', () => {
    expect(istBildschirmtext('src/components/__tests__/BudgetTile.test.tsx')).toBe(false);
  });

  it('sollte Dateien ohne JSX nicht prüfen', () => {
    expect(istBildschirmtext('src/lib/money.ts')).toBe(false);
  });
});

describe('findeZuKleinenText', () => {
  it('sollte eine Tailwind-Klasse unter der Lesbarkeitsgrenze melden', () => {
    const quelle = `<span className="text-[10px] text-muted-foreground">/ 100</span>`;
    const funde = findeZuKleinenText(quelle, 'src/components/Karte.tsx');
    expect(funde).toHaveLength(1);
    expect(funde[0].px).toBe(10);
    expect(funde[0].quelle).toBe('text-[10px]');
  });

  it('sollte jede zu kleine Klasse einer Datei melden, nicht nur die erste', () => {
    const quelle = `
      <div className="text-[8px]">A</div>
      <div className="text-[9px]">B</div>
    `;
    expect(findeZuKleinenText(quelle, 'src/components/Karte.tsx')).toHaveLength(2);
  });

  it('sollte rem in px umrechnen', () => {
    const quelle = `<span className="text-[0.625rem]">winzig</span>`;
    const funde = findeZuKleinenText(quelle, 'src/components/Karte.tsx');
    expect(funde).toHaveLength(1);
    expect(funde[0].px).toBe(10);
  });

  it('sollte die Grenze selbst durchlassen', () => {
    const quelle = `<span className="text-[11px]">gerade noch</span>`;
    expect(findeZuKleinenText(quelle, 'src/components/Karte.tsx')).toEqual([]);
  });

  it('sollte die benannte Skala nicht anfassen — text-xs sind 12px', () => {
    const quelle = `<span className="text-xs text-sm text-base">ok</span>`;
    expect(findeZuKleinenText(quelle, 'src/components/Karte.tsx')).toEqual([]);
  });

  it('sollte ein zu kleines fontSize-Literal melden', () => {
    const quelle = `<Text fontSize={10} />`;
    const funde = findeZuKleinenText(quelle, 'src/components/Chart.tsx');
    expect(funde).toHaveLength(1);
    expect(funde[0].px).toBe(10);
  });

  it('sollte fontSize in einem style-Objekt melden', () => {
    const quelle = `<div style={{ fontSize: 9, fontWeight: 600 }}>x</div>`;
    expect(findeZuKleinenText(quelle, 'src/components/Chart.tsx')).toHaveLength(1);
  });

  it('sollte fontSize als px-Zeichenkette melden', () => {
    const quelle = `<div style={{ fontSize: '9px' }}>x</div>`;
    expect(findeZuKleinenText(quelle, 'src/components/Chart.tsx')).toHaveLength(1);
  });

  it('sollte ein berechnetes fontSize in Ruhe lassen — es ist statisch nicht entscheidbar', () => {
    const quelle = `<div style={{ fontSize: size * 0.6 }}>x</div>`;
    expect(findeZuKleinenText(quelle, 'src/components/Chart.tsx')).toEqual([]);
  });

  it('sollte eine CSS-Variable in Ruhe lassen', () => {
    const quelle = `<div style={{ fontSize: 'var(--font-size-headline, 1.25rem)' }}>x</div>`;
    expect(findeZuKleinenText(quelle, 'src/components/Chart.tsx')).toEqual([]);
  });

  it('sollte Papier nicht für einen Bildschirm halten (jsPDF)', () => {
    const quelle = `
      import jsPDF from 'jspdf';
      autoTable(doc, { styles: { fontSize: 8 } });
    `;
    expect(findeZuKleinenText(quelle, 'src/components/DataExport.tsx')).toEqual([]);
  });

  it('sollte Papier auch bei dynamischem Import erkennen (import("jspdf"))', () => {
    const quelle = `
      const [{ default: jsPDF }] = await Promise.all([import('jspdf')]);
      autoTable(doc, { styles: { fontSize: 8 } });
    `;
    expect(findeZuKleinenText(quelle, 'src/components/DataExport.tsx')).toEqual([]);
  });

  it('sollte eine WebGL-Sprite-Groesse nicht für DOM-Text halten (three.js)', () => {
    const quelle = `
      import * as THREE from 'three';
      const beschriftung = { fontSize: 6 };
    `;
    expect(findeZuKleinenText(quelle, 'src/features/finance-city/City.tsx')).toEqual([]);
  });

  // [REGRESSION] Die erste Fassung schloss die GANZE Datei aus, sobald sie
  // jspdf oder three einband — und uebersah damit drei SVG-Beschriftungen in
  // SankeyChart.tsx (die Datei laedt jsPDF nur fuer den Export) sowie die
  // DOM-Ueberlagerung von CityLabels.tsx ueber der WebGL-Stadt. Dieselbe
  // Fehlerform wie bei check:money-format: Eine Datei ist nicht erledigt, weil
  // IRGENDWO darin richtig gearbeitet wird. Die Ausnahme haengt seither an der
  // POSITION, nicht an der Datei.
  it('[REGRESSION] sollte SVG-Beschriftungen melden, auch wenn die Datei jsPDF exportiert', () => {
    const quelle = `
      const [{ default: jsPDF }] = await Promise.all([import("jspdf")]);
      export const Node = () => <text fontSize={10}>{label}</text>;
    `;
    const funde = findeZuKleinenText(quelle, 'src/components/SankeyChart.tsx');
    expect(funde).toHaveLength(1);
    expect(funde[0].quelle).toContain('fontSize={10}');
  });

  it('[REGRESSION] sollte eine DOM-Ueberlagerung ueber einer WebGL-Szene melden', () => {
    const quelle = `
      import * as THREE from 'three';
      export const Labels = () => <span className="text-[10px]">{name}</span>;
    `;
    expect(findeZuKleinenText(quelle, 'src/features/finance-city/CityLabels.tsx')).toHaveLength(1);
  });

  it('sollte einen Kommentar nicht melden', () => {
    const quelle = `
      // frueher stand hier text-[9px] — siehe AGENTS.md §9
      <span className="text-xs">ok</span>
    `;
    expect(findeZuKleinenText(quelle, 'src/components/Karte.tsx')).toEqual([]);
  });

  it('sollte die Grenze exportieren, damit die Meldung sie nicht zweitschreibt', () => {
    expect(MIN_LESBAR_PX).toBe(11);
  });
});
