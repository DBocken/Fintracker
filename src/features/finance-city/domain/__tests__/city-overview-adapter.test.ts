import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildCityOverviewModel, OVERVIEW_BALANCE_DISTRICT_ID } from '../city-overview-adapter';
import type { CityModel } from '../city-model';

beforeEach(() => {
  window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
});
afterEach(() => {
  window.localStorage.removeItem('ausgabentracker_locale_v1');
});

function model(districts: { id: string; total: number }[]): CityModel {
  return {
    districts: districts.map((d) => ({
      id: d.id,
      label: d.id,
      color: '#123456',
      total: d.total,
      subcategories: [{ id: 'x', label: d.id, amount: d.total }],
    })),
  };
}

describe('buildCityOverviewModel', () => {
  it('sollte Einnahmen links, Ausgaben rechts und den Spar-Turm mittig platzieren — Ids bleiben identisch zu den Welt-Modellen', () => {
    const { model: overview, info } = buildCityOverviewModel(
      model([{ id: 'exp-wohnen', total: 1500 }]),
      model([{ id: 'income:gehalt', total: 3000 }]),
    );

    const byId = new Map(overview.districts.map((d) => [d.id, d]));
    expect(byId.get('income:gehalt')?.side).toBe('left');
    expect(byId.get('exp-wohnen')?.side).toBe('right');
    expect(byId.get(OVERVIEW_BALANCE_DISTRICT_ID)?.side).toBe('center');
    expect(info.incomeDistrictIds).toEqual(['income:gehalt']);
    expect(overview.hideShares).toBe(true);
  });

  it('sollte den Saldo Cent-genau aus den angezeigten Distrikt-Totalen bilden (Gold-Turm "Sparrate" bei Überschuss)', () => {
    const { model: overview, info } = buildCityOverviewModel(
      model([{ id: 'exp', total: 2100.1 }]),
      model([{ id: 'income:a', total: 3000.05 }]),
    );

    expect(info.incomeTotal).toBeCloseTo(3000.05, 10);
    expect(info.expensesTotal).toBeCloseTo(2100.1, 10);
    expect(info.balance).toBeCloseTo(899.95, 10);

    const tower = overview.districts.find((d) => d.id === OVERVIEW_BALANCE_DISTRICT_ID)!;
    expect(tower.total).toBeCloseTo(899.95, 10);
    expect(tower.label).toBe('Sparrate');
    expect(tower.color).toBe('#f0b429');
  });

  it('sollte bei Defizit einen roten "Defizit"-Turm in Höhe des Fehlbetrags bauen', () => {
    const { model: overview, info } = buildCityOverviewModel(
      model([{ id: 'exp', total: 3200 }]),
      model([{ id: 'income:a', total: 3000 }]),
    );

    expect(info.balance).toBeCloseTo(-200, 10);
    const tower = overview.districts.find((d) => d.id === OVERVIEW_BALANCE_DISTRICT_ID)!;
    expect(tower.total).toBeCloseTo(200, 10); // Turmhöhe = |Saldo|.
    expect(tower.label).toBe('Defizit');
    expect(tower.color).toBe('#ef4444');
  });

  it('sollte ohne beide Seiten ein leeres Modell liefern und bei Saldo 0 keinen (unsichtbaren) Null-Turm bauen', () => {
    expect(buildCityOverviewModel(model([]), model([])).model.districts).toHaveLength(0);

    const { model: even } = buildCityOverviewModel(
      model([{ id: 'exp', total: 1000 }]),
      model([{ id: 'income:a', total: 1000 }]),
    );
    expect(even.districts.find((d) => d.id === OVERVIEW_BALANCE_DISTRICT_ID)).toBeUndefined();
    expect(even.districts).toHaveLength(2);
  });
});
