/**
 * WP 6.4 (ARCH-5): Atmosphaeren-Preset der Stadt (WP-4.3). Lag als `useMemo`
 * in `CityPage.tsx` — die Zuordnung „Temperatur → Preset" ist reine Ableitung.
 */
import { describe, it, expect } from 'vitest';
import { deriveCityAtmospherePreset } from '../city-atmosphere';

describe('deriveCityAtmospherePreset', () => {
  it('sollte in der Uebersicht bei Ueberschuss ein stabiles Preset liefern', () => {
    expect(
      deriveCityAtmospherePreset({
        isOverview: true,
        overview: { incomeTotal: 3000, expensesTotal: 2000, balance: 1000, incomeDistrictIds: [] },
      }),
    ).toBe('stable');
  });

  it('sollte in der Uebersicht bei Unterdeckung ein Risiko-Preset liefern', () => {
    expect(
      deriveCityAtmospherePreset({
        isOverview: true,
        overview: { incomeTotal: 1500, expensesTotal: 2000, balance: -500, incomeDistrictIds: [] },
      }),
    ).toBe('risk');
  });

  it('sollte bei ausgeglichenem Saldo neutral bleiben', () => {
    expect(
      deriveCityAtmospherePreset({
        isOverview: true,
        overview: { incomeTotal: 2000, expensesTotal: 2000, balance: 0, incomeDistrictIds: [] },
      }),
    ).toBe('neutral');
  });

  it('sollte ausserhalb der Uebersicht neutral bleiben — einseitige Daten tragen keine Stimmung', () => {
    expect(deriveCityAtmospherePreset({ isOverview: false })).toBe('neutral');
    expect(deriveCityAtmospherePreset({ isOverview: false, valueKind: 'progress' })).toBe('neutral');
  });

  it('sollte neutral bleiben, solange die Uebersichts-Kennzahlen fehlen', () => {
    expect(deriveCityAtmospherePreset({ isOverview: true })).toBe('neutral');
    expect(deriveCityAtmospherePreset({ isOverview: true, overview: undefined })).toBe('neutral');
  });
});
