/**
 * Was ein Tap auf einen Baukörper fachlich bedeutet (WP 6.4, ARCH-5/KOMP-1).
 *
 * Der Raycast (`city-scene.ts#pick`) liefert eine Box-Id nach der Konvention
 * aus `city-layout.ts`: Hülle = `districtId`, Balken = `districtId/subId`,
 * Etage = `districtId/subId/contractId`. Diese Zuordnung ist reine Domänen-
 * Logik — sie lag bis WP 6.4 als `handleTapBox` in `CityPage.tsx` und war
 * damit nur hinter einem WebGL-Canvas erreichbar, den jsdom nicht aufbauen
 * kann. Hier ist sie ohne Canvas prüfbar.
 *
 * `world` (statt eines Tab-Namens) hält die Domäne unabhängig von der
 * Application-Schicht: welcher Tab welche Welt zeigt, entscheidet dort
 * `CityModelTab` — hier zählt nur, dass es die Einnahmen- oder die
 * Ausgaben-Welt ist.
 */

import { OVERVIEW_BALANCE_DISTRICT_ID } from './city-overview-adapter';

export type CityTapTarget =
  /** Boden/Leere, oder ein reines Readout (Spar-Turm der Übersicht) — bewusst nichts tun. */
  | { kind: 'none' }
  | { kind: 'district'; districtId: string }
  | { kind: 'subcategory'; subcategoryId: string }
  | { kind: 'contract'; contractId: string }
  /** WP-D8: zweiter Tap auf ein Übersichts-Viertel — Weltwechsel UND Distrikt betreten. */
  | { kind: 'enter-world'; districtId: string; world: 'income' | 'expenses' };

export type CityTapContext = {
  /** Übersichts-Welt (WP-D8): dort ist der zweite Tap ein Weltsprung, kein Eintauchen. */
  isOverview: boolean;
  /** Aktuell fokussiertes (noch nicht betretenes) Viertel — unterscheidet ersten von zweitem Tap. */
  focusDistrictId: string | null;
  /** Distrikt-Ids der Einnahmen-Seite der Übersicht (`CityOverviewInfo.incomeDistrictIds`). */
  incomeDistrictIds: ReadonlySet<string>;
};

export function resolveCityTapTarget(boxId: string | null, ctx: CityTapContext): CityTapTarget {
  if (!boxId) return { kind: 'none' };
  const parts = boxId.split('/');

  // WP-D8 (Übersicht): erster Tap fokussiert das Viertel (bestehende
  // Twostep-Semantik), der zweite springt in dessen WELT und betritt dort
  // denselben Distrikt (Ids sind in Übersicht und Welt-Modell identisch).
  if (ctx.isOverview && parts.length === 1) {
    // Der Spar-Turm ist reines Readout — er hat keine Welt hinter sich.
    if (boxId === OVERVIEW_BALANCE_DISTRICT_ID) return { kind: 'none' };
    if (ctx.focusDistrictId === boxId) {
      return { kind: 'enter-world', districtId: boxId, world: ctx.incomeDistrictIds.has(boxId) ? 'income' : 'expenses' };
    }
    return { kind: 'district', districtId: boxId };
  }

  if (parts.length === 1) return { kind: 'district', districtId: parts[0] };
  if (parts.length === 2) return { kind: 'subcategory', subcategoryId: parts[1] };
  return { kind: 'contract', contractId: parts[2] };
}
