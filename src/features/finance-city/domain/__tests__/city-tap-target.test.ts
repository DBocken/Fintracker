/**
 * WP 6.4 (ARCH-5/KOMP-1): Zuordnung „Raycast-Ergebnis (Box-Id) → Fachobjekt".
 * Lag bis hierher als `handleTapBox` in `CityPage.tsx` — also hinter einem
 * WebGL-Canvas, den jsdom nicht aufbauen kann. Die Id-Konvention selbst
 * (`districtId`, `districtId/subId`, `districtId/subId/contractId`,
 * `city-layout.ts`) ist reine Domaenen-Logik und hier ohne Canvas pruefbar.
 */
import { describe, it, expect } from 'vitest';
import { resolveCityTapTarget } from '../city-tap-target';
import { OVERVIEW_BALANCE_DISTRICT_ID } from '../city-overview-adapter';

const KEINE_EINNAHMEN: ReadonlySet<string> = new Set();

describe('resolveCityTapTarget', () => {
  it('sollte bei Tap auf Boden/Leere nichts tun', () => {
    expect(
      resolveCityTapTarget(null, { isOverview: false, focusDistrictId: null, incomeDistrictIds: KEINE_EINNAHMEN }),
    ).toEqual({ kind: 'none' });
  });

  it('sollte eine einteilige Id als Distrikt-Tap lesen', () => {
    expect(
      resolveCityTapTarget('leisure', { isOverview: false, focusDistrictId: null, incomeDistrictIds: KEINE_EINNAHMEN }),
    ).toEqual({ kind: 'district', districtId: 'leisure' });
  });

  it('sollte eine zweiteilige Id als Unterkategorie-Tap lesen (Balken)', () => {
    expect(
      resolveCityTapTarget('leisure/streaming', {
        isOverview: false,
        focusDistrictId: null,
        incomeDistrictIds: KEINE_EINNAHMEN,
      }),
    ).toEqual({ kind: 'subcategory', subcategoryId: 'streaming' });
  });

  it('sollte eine dreiteilige Id als Vertrags-Tap lesen (Etage)', () => {
    expect(
      resolveCityTapTarget('leisure/streaming/netflix', {
        isOverview: false,
        focusDistrictId: null,
        incomeDistrictIds: KEINE_EINNAHMEN,
      }),
    ).toEqual({ kind: 'contract', contractId: 'netflix' });
  });

  it('sollte in der Uebersicht beim ERSTEN Tap nur fokussieren', () => {
    expect(
      resolveCityTapTarget('leisure', { isOverview: true, focusDistrictId: null, incomeDistrictIds: KEINE_EINNAHMEN }),
    ).toEqual({ kind: 'district', districtId: 'leisure' });
  });

  it('sollte in der Uebersicht beim ZWEITEN Tap in die Ausgaben-Welt springen', () => {
    expect(
      resolveCityTapTarget('leisure', {
        isOverview: true,
        focusDistrictId: 'leisure',
        incomeDistrictIds: KEINE_EINNAHMEN,
      }),
    ).toEqual({ kind: 'enter-world', districtId: 'leisure', world: 'expenses' });
  });

  it('sollte in der Uebersicht beim ZWEITEN Tap auf ein Einnahmen-Viertel in die Einnahmen-Welt springen', () => {
    expect(
      resolveCityTapTarget('salary', {
        isOverview: true,
        focusDistrictId: 'salary',
        incomeDistrictIds: new Set(['salary']),
      }),
    ).toEqual({ kind: 'enter-world', districtId: 'salary', world: 'income' });
  });

  it('sollte den Spar-Turm der Uebersicht als reines Readout behandeln (kein Ziel)', () => {
    expect(
      resolveCityTapTarget(OVERVIEW_BALANCE_DISTRICT_ID, {
        isOverview: true,
        focusDistrictId: OVERVIEW_BALANCE_DISTRICT_ID,
        incomeDistrictIds: KEINE_EINNAHMEN,
      }),
    ).toEqual({ kind: 'none' });
  });

  it('sollte in der Uebersicht mehrteilige Ids wie in jeder anderen Welt behandeln', () => {
    expect(
      resolveCityTapTarget('leisure/streaming', {
        isOverview: true,
        focusDistrictId: 'leisure',
        incomeDistrictIds: KEINE_EINNAHMEN,
      }),
    ).toEqual({ kind: 'subcategory', subcategoryId: 'streaming' });
  });
});
