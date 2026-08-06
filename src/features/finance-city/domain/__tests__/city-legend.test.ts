import { describe, it, expect } from 'vitest';
import { cityLegendItems, CITY_LEGEND_ITEMS, type CityLegendInput } from '../city-legend';
import type { CityModel } from '../city-model';

/**
 * WP-5.8 — die Legende erklärt NUR, was gerade zu sehen ist.
 *
 * Eine feste Aufzählung wäre in drei von vier Tabs falsch: im Ziele-Tab
 * bedeutet Höhe Fortschritt und nicht Euro, Flusslinien gibt es nur auf
 * Stadt-Ebene der Ausgaben, und ohne Etagen-Daten gibt es keine Aktivität.
 * Eine Erklärung für etwas, das nicht auf dem Schirm ist, ist schlimmer als
 * keine — sie schickt den Blick auf die Suche.
 */
const EXPENSES: CityModel = {
  districts: [
    {
      id: 'living',
      label: 'Lebenshaltung',
      color: '#3b82f6',
      total: 400,
      subcategories: [{ id: 'food', label: 'Lebensmittel', amount: 400, activity: 'busy' }],
    },
    {
      id: 'leisure',
      label: 'Freizeit',
      color: '#f97316',
      total: 100,
      subcategories: [{ id: 'streaming', label: 'Streaming', amount: 100 }],
    },
  ],
};

const GOALS: CityModel = {
  valueKind: 'progress',
  districts: [
    {
      id: 'goal:puffer',
      label: 'Puffer',
      color: '#3b82f6',
      total: 0.6,
      targetAmount: 1,
      stage: 'underway',
      subcategories: [{ id: 'progress', label: 'Puffer', amount: 0.6 }],
    },
  ],
};

function items(overrides: Partial<CityLegendInput> = {}) {
  return cityLegendItems({ model: EXPENSES, level: 'city', hasFlowLines: false, ...overrides });
}

describe('cityLegendItems', () => {
  it('sollte die Höhe immer erklären', () => {
    expect(items()).toContain('height');
  });

  it('sollte im Ziele-Tab Fortschritt statt Betrag erklären', () => {
    const goalItems = cityLegendItems({ model: GOALS, level: 'city', hasFlowLines: false });
    expect(goalItems).toContain('heightProgress');
    expect(goalItems, 'Euro-Erklärung im Fortschritts-Tab').not.toContain('height');
  });

  it('[REGRESSION] sollte im Ziele-Tab die Distriktfarbe NICHT erklären', () => {
    // Dort trägt die Farbe die Fortschritts-Stufe (WP-5.3), nicht den Bereich —
    // die Distrikt-Erklärung wäre schlicht unwahr.
    const goalItems = cityLegendItems({ model: GOALS, level: 'city', hasFlowLines: false });
    expect(goalItems).not.toContain('districtColor');
    expect(goalItems).toContain('goalStage');
  });

  it('sollte die Distriktfarbe nur bei mehreren Distrikten erklären', () => {
    // Bei genau einem Viertel gibt es nichts zu unterscheiden.
    const single: CityModel = { districts: [EXPENSES.districts[0]] };
    expect(items({ model: single })).not.toContain('districtColor');
    expect(items()).toContain('districtColor');
  });

  it('sollte die Hülle nur erklären, wenn es ein Soll gibt', () => {
    expect(items()).not.toContain('hull');
    expect(cityLegendItems({ model: GOALS, level: 'city', hasFlowLines: false })).toContain('hull');
  });

  it('sollte Etagen erst ab der Distrikt-Ebene erklären', () => {
    const withFloors: CityModel = {
      districts: [
        {
          ...EXPENSES.districts[0],
          subcategories: [
            {
              id: 'food',
              label: 'Lebensmittel',
              amount: 400,
              contracts: [{ id: 'aldi', label: 'Aldi', amount: 400 }],
            },
          ],
        },
      ],
    };
    expect(items({ model: withFloors, level: 'city' })).not.toContain('floors');
    expect(items({ model: withFloors, level: 'district' })).toContain('floors');
  });

  it('sollte Flusslinien nur erklären, wenn welche gezeichnet werden', () => {
    // Nicht aus dem Modell ableitbar: die Qualitätsstufe kann sie abschalten,
    // obwohl es wiederkehrende Zahlungen gibt.
    expect(items({ hasFlowLines: false })).not.toContain('flowLines');
    expect(items({ hasFlowLines: true })).toContain('flowLines');
  });

  it('sollte die Fassaden-Aktivität nur bei vorhandener Angabe erklären', () => {
    expect(items()).toContain('activity');
    const withoutActivity: CityModel = {
      districts: [{ ...EXPENSES.districts[1] }],
    };
    expect(items({ model: withoutActivity })).not.toContain('activity');
  });

  it('sollte eine feste Anzeigereihenfolge einhalten', () => {
    // Unabhängig davon, in welcher Reihenfolge die Regeln zuschlagen.
    const result = items({ hasFlowLines: true, level: 'district' });
    const positions = result.map((item) => CITY_LEGEND_ITEMS.indexOf(item));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('sollte keinen Eintrag doppelt liefern', () => {
    const result = items({ hasFlowLines: true, level: 'district' });
    expect(new Set(result).size).toBe(result.length);
  });

  it('sollte für ein leeres Modell nur die Höhe erklären', () => {
    expect(items({ model: { districts: [] } })).toEqual(['height']);
  });
});
