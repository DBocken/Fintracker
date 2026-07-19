import { describe, expect, it } from 'vitest';
import {
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  estimateMinHeight,
  expectNoLayoutOverlap,
  findLayoutOverlapViolations,
} from '../layout-overlap';

/**
 * Tests des generischen Layout-Überlappungs-Wächters: Negativfälle müssen
 * erkannt (Verstoß gemeldet), Positivfälle dürfen nicht gemeldet werden —
 * der Wächter ist konservativ und meldet nur sichere Überlappungen.
 */

function dom(html: string): Element {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('layout-overlap – generischer Überlappungs-Wächter', () => {
  describe('Negativfälle: Verstöße werden erkannt', () => {
    it('[REGRESSION] sollte den Screenshot-Bug erkennen: mehrzeiliger Wrapper mit fester Höhe kollabiert (Buchung aufteilen)', () => {
      // Nachbau des fehlerhaften Markups vor dem Fix: h-8 auf dem Wrapper,
      // der Badge-Zeile + Select-Zeile (Trigger h-10) enthält.
      const root = dom(`
        <div class="flex flex-col gap-2 h-8 text-sm">
          <div class="flex flex-wrap items-center gap-2"><span>1.</span><span>2.</span></div>
          <div class="flex gap-2">
            <button class="flex h-10 items-center w-44">Kategorie wählen…</button>
          </div>
        </div>
      `);
      const violations = findLayoutOverlapViolations(root, MOBILE_VIEWPORT);
      expect(violations.some((v) => v.type === 'vertical-collapse')).toBe(true);
      // Der Kollaps ist viewport-unabhängig — auch auf Desktop ein Verstoß.
      const desktop = findLayoutOverlapViolations(root, DESKTOP_VIEWPORT);
      expect(desktop.some((v) => v.type === 'vertical-collapse')).toBe(true);
    });

    it('[MOBILE] sollte horizontalen Überlauf erkennen: feste Breiten sprengen den mobilen Viewport', () => {
      // w-44 (176px) + w-48 (192px) + gap-2 (8px) = 376px > 360px.
      const root = dom(`
        <div class="flex gap-2">
          <button class="w-44">Hauptkategorie</button>
          <button class="w-48">Unterkategorie</button>
        </div>
      `);
      const mobile = findLayoutOverlapViolations(root, MOBILE_VIEWPORT);
      expect(mobile.some((v) => v.type === 'horizontal-overflow')).toBe(true);
      // Auf Desktop passt dieselbe Zeile — kein Verstoß.
      const desktop = findLayoutOverlapViolations(root, DESKTOP_VIEWPORT);
      expect(desktop).toEqual([]);
    });

    it('sollte feste Höhe mit gestapelten festen Kind-Höhen samt Gap und Padding erkennen', () => {
      // 2×h-10 (80px) + gap-2 (8px) + py-2 (16px) = 104px > h-20 (80px).
      const root = dom(`
        <div class="flex flex-col gap-2 py-2 h-20">
          <div class="h-10"></div>
          <div class="h-10"></div>
        </div>
      `);
      expect(findLayoutOverlapViolations(root, DESKTOP_VIEWPORT).length).toBe(1);
    });

    it('sollte Breakpoint-Präfixe pro Viewport auflösen (Verstoß nur dort, wo die Klasse wirkt)', () => {
      // h-8 gilt erst ab sm: — mobil (Basis h-auto) kein Verstoß, Desktop schon.
      const root = dom(`
        <div class="flex flex-col sm:h-8">
          <div class="h-10"></div>
          <div class="h-10"></div>
        </div>
      `);
      expect(findLayoutOverlapViolations(root, MOBILE_VIEWPORT)).toEqual([]);
      expect(findLayoutOverlapViolations(root, DESKTOP_VIEWPORT).length).toBe(1);
    });

    it('sollte expectNoLayoutOverlap mit lesbarer Fehlermeldung fehlschlagen lassen', () => {
      const root = dom(`
        <div class="h-8"><div class="h-16"></div></div>
      `);
      expect(() => expectNoLayoutOverlap(root)).toThrow(/vertical-collapse/);
    });
  });

  describe('Positivfälle: korrekte Layouts werden nicht gemeldet', () => {
    it('sollte das korrigierte Markup der Kategorie-Auswahl akzeptieren (mobil gestapelt, Desktop begrenzt)', () => {
      // Markup nach dem Fix: keine Höhe auf dem Wrapper, Trigger mobile-first.
      const root = dom(`
        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap items-center gap-2"><span>1.</span><span>2.</span></div>
          <div class="flex flex-col gap-2 sm:flex-row">
            <button class="flex h-8 items-center w-full min-w-0 sm:w-44">Kategorie wählen…</button>
            <button class="flex h-8 items-center w-full min-w-0 sm:w-48">Unterkategorie</button>
          </div>
        </div>
      `);
      expect(findLayoutOverlapViolations(root, MOBILE_VIEWPORT)).toEqual([]);
      expect(findLayoutOverlapViolations(root, DESKTOP_VIEWPORT)).toEqual([]);
    });

    it('sollte ausreichende feste Höhen nicht melden (Inhalt passt)', () => {
      const root = dom(`
        <button class="h-20 flex flex-col items-center justify-center gap-2">
          <svg class="h-6 w-6"></svg>
          <span>Export</span>
        </button>
      `);
      expect(findLayoutOverlapViolations(root, DESKTOP_VIEWPORT)).toEqual([]);
    });

    it('sollte Container mit Overflow-Handling nicht melden', () => {
      const root = dom(`
        <div class="h-8 overflow-hidden"><div class="h-16"></div></div>
        <div class="h-8 overflow-y-auto"><div class="h-16"></div></div>
        <div class="flex gap-2 overflow-x-auto"><div class="w-44"></div><div class="w-48"></div></div>
      `);
      expect(findLayoutOverlapViolations(root, MOBILE_VIEWPORT)).toEqual([]);
    });

    it('sollte umbrechende und mobil gestapelte Flex-Zeilen nicht melden', () => {
      const root = dom(`
        <div class="flex flex-wrap gap-2"><div class="w-44"></div><div class="w-48"></div></div>
        <div class="flex flex-col sm:flex-row gap-2"><div class="sm:w-44"></div><div class="sm:w-48"></div></div>
      `);
      expect(findLayoutOverlapViolations(root, MOBILE_VIEWPORT)).toEqual([]);
    });

    it('sollte absolut positionierte und ausgeblendete Kinder nicht in den Fluss einrechnen', () => {
      const root = dom(`
        <div class="h-8 relative">
          <div class="absolute h-16"></div>
          <div class="hidden h-16"></div>
        </div>
      `);
      expect(findLayoutOverlapViolations(root, DESKTOP_VIEWPORT)).toEqual([]);
    });

    it('sollte Inline-Kinder in Block-Containern nicht aufsummieren (teilen sich eine Zeile)', () => {
      const root = dom(`
        <div class="h-8">
          <span class="h-6"></span>
          <span class="h-6"></span>
        </div>
      `);
      expect(findLayoutOverlapViolations(root, DESKTOP_VIEWPORT)).toEqual([]);
    });

    it('sollte unbekannte Höhen (Text, prozentuale Größen) konservativ als 0 ansetzen', () => {
      const root = dom(`
        <div class="h-8"><p>Beliebig langer Text ohne feste Höhenklasse</p><div class="h-full"></div></div>
      `);
      expect(findLayoutOverlapViolations(root, DESKTOP_VIEWPORT)).toEqual([]);
    });
  });

  describe('estimateMinHeight', () => {
    it('sollte feste Höhen, Stapel und Zeilen korrekt schätzen', () => {
      const fixed = dom('<div class="h-10"></div>').firstElementChild as Element;
      expect(estimateMinHeight(fixed, DESKTOP_VIEWPORT)).toBe(40);

      const stack = dom('<div class="flex flex-col gap-2"><div class="h-10"></div><div class="h-8"></div></div>')
        .firstElementChild as Element;
      expect(estimateMinHeight(stack, DESKTOP_VIEWPORT)).toBe(40 + 32 + 8);

      const row = dom('<div class="flex gap-2"><div class="h-10"></div><div class="h-8"></div></div>')
        .firstElementChild as Element;
      expect(estimateMinHeight(row, DESKTOP_VIEWPORT)).toBe(40);
    });
  });
});
