import { describe, it, expect } from 'vitest';
import { buildCityLayout, computeFocusBounds } from '../city-layout';
import type { CityModel } from '../city-model';

function makeModel(): CityModel {
  return {
    districts: [
      {
        id: 'housing',
        label: 'Wohnen',
        color: '#1d5c54',
        total: 980 + 89 + 28.5 + 45,
        subcategories: [
          { id: 'rent', label: 'Miete', amount: 980 },
          { id: 'utilities', label: 'Nebenkosten', amount: 89 },
          { id: 'insurance', label: 'Hausratversicherung', amount: 28.5 },
          { id: 'furniture', label: 'Möbel & Hausrat', amount: 45 },
        ],
      },
      {
        id: 'living',
        label: 'Lebenshaltung',
        color: '#8a7d5a',
        total: 238.1 + 16.9 + 24 + 30,
        subcategories: [
          { id: 'groceries', label: 'Lebensmittel', amount: 238.1 },
          { id: 'health', label: 'Gesundheit', amount: 16.9 },
          { id: 'personalCare', label: 'Drogerie', amount: 24 },
          { id: 'household', label: 'Haushaltswaren', amount: 30 },
        ],
      },
      {
        id: 'leisure',
        label: 'Freizeit',
        color: '#7d6b8a',
        total: 57.4 + 25 + 40 + 79.99 + 39.97,
        subcategories: [
          { id: 'dining', label: 'Restaurant', amount: 57.4 },
          { id: 'events', label: 'Kino & Veranstaltungen', amount: 25 },
          { id: 'hobbies', label: 'Hobbys', amount: 40 },
          { id: 'shopping', label: 'Shopping', amount: 79.99 },
          {
            id: 'streaming',
            label: 'Streaming & Abos',
            amount: 39.97,
            contracts: [
              { id: 'netflix', label: 'Netflix', amount: 17.99 },
              { id: 'spotify', label: 'Spotify', amount: 10.99 },
              { id: 'hbo', label: 'HBO', amount: 9.99 },
              { id: 'apple_tv', label: 'Apple TV', amount: 1.0 },
            ],
          },
        ],
      },
      {
        id: 'mobility',
        label: 'Mobilität',
        color: '#5c7a99',
        total: 132.5 + 49 + 42 + 18,
        subcategories: [
          { id: 'fuel', label: 'Tanken', amount: 132.5 },
          { id: 'publicTransit', label: 'Öffentliche Verkehrsmittel', amount: 49 },
          { id: 'carInsurance', label: 'Kfz-Versicherung', amount: 42 },
          { id: 'parking', label: 'Parken', amount: 18 },
        ],
      },
    ],
  };
}

describe('buildCityLayout', () => {
  describe('Determinismus', () => {
    it('sollte bei identischem Input zweimal exakt dasselbe Layout liefern (deepEqual)', () => {
      const model = makeModel();
      const layout1 = buildCityLayout(model, { level: 'city' });
      const layout2 = buildCityLayout(model, { level: 'city' });
      expect(layout1).toEqual(layout2);
    });

    it('sollte auch auf district- und subcategory-Ebene deterministisch sein', () => {
      const model = makeModel();
      const districtView = { level: 'district' as const, focusDistrictId: 'leisure' };
      const subView = {
        level: 'subcategory' as const,
        focusDistrictId: 'leisure',
        focusSubcategoryId: 'streaming',
      };
      expect(buildCityLayout(model, districtView)).toEqual(buildCityLayout(model, districtView));
      expect(buildCityLayout(model, subView)).toEqual(buildCityLayout(model, subView));
    });
  });

  describe('Fußpunkt-Invariante', () => {
    it('sollte für alle Balken (bar) center.y === size.y/2 sein (Bodenhöhe 0, Fußpunkt auf Grundstück)', () => {
      const model = makeModel();
      const layout = buildCityLayout(model, { level: 'city' });
      const bars = layout.boxes.filter((b) => b.kind === 'bar');
      expect(bars.length).toBeGreaterThan(0);
      for (const bar of bars) {
        expect(bar.center.y).toBeCloseTo(bar.size.y / 2, 10);
      }
    });

    it('sollte das auch auf district-Ebene gelten', () => {
      const model = makeModel();
      const layout = buildCityLayout(model, { level: 'district', focusDistrictId: 'housing' });
      const bars = layout.boxes.filter((b) => b.kind === 'bar');
      expect(bars.length).toBe(4);
      for (const bar of bars) {
        expect(bar.center.y).toBeCloseTo(bar.size.y / 2, 10);
      }
    });
  });

  describe('Vergleichbarkeit über Viertel hinweg', () => {
    it('sollte Miete (980, housing) als höchsten Balken der GESAMTEN Stadt ausweisen', () => {
      const model = makeModel();
      const layout = buildCityLayout(model, { level: 'city' });
      const bars = layout.boxes.filter((b) => b.kind === 'bar');
      const rentBar = bars.find((b) => b.id === 'housing/rent')!;
      expect(rentBar).toBeDefined();
      const maxHeight = Math.max(...bars.map((b) => b.size.y));
      expect(rentBar.size.y).toBeCloseTo(maxHeight, 10);
    });

    it('sollte dieselbe Unterkategorie auf district-Ebene dieselbe Höhe wie auf city-Ebene haben (city-weiter maxAmount)', () => {
      const model = makeModel();
      const cityLayout = buildCityLayout(model, { level: 'city' });
      const districtLayout = buildCityLayout(model, { level: 'district', focusDistrictId: 'housing' });

      const cityRentBar = cityLayout.boxes.find((b) => b.id === 'housing/rent')!;
      const districtRentBar = districtLayout.boxes.find((b) => b.id === 'housing/rent')!;
      expect(districtRentBar.size.y).toBeCloseTo(cityRentBar.size.y, 10);
    });
  });

  describe('Floor-Ersetzung (subcategory-Ebene)', () => {
    it('sollte den fokussierten Streaming-Balken durch 4 Etagen ersetzen, deren Höhensumme exakt der ursprünglichen Balkenhöhe entspricht', () => {
      const model = makeModel();
      const districtLayout = buildCityLayout(model, { level: 'district', focusDistrictId: 'leisure' });
      const streamingBar = districtLayout.boxes.find((b) => b.id === 'leisure/streaming')!;
      expect(streamingBar).toBeDefined();
      const originalBarHeight = streamingBar.size.y;

      const subLayout = buildCityLayout(model, {
        level: 'subcategory',
        focusDistrictId: 'leisure',
        focusSubcategoryId: 'streaming',
      });

      // Der Streaming-BALKEN selbst ist weg.
      expect(subLayout.boxes.find((b) => b.id === 'leisure/streaming')).toBeUndefined();

      // 4 Etagen (floor) sind da, mit den erwarteten Contract-IDs.
      const floors = subLayout.boxes.filter((b) => b.kind === 'floor');
      expect(floors).toHaveLength(4);
      expect(floors.map((f) => f.id).sort()).toEqual(
        [
          'leisure/streaming/netflix',
          'leisure/streaming/spotify',
          'leisure/streaming/hbo',
          'leisure/streaming/apple_tv',
        ].sort(),
      );

      const sumHeights = floors.reduce((acc, f) => acc + f.size.y, 0);
      expect(sumHeights).toBeCloseTo(originalBarHeight, 10);
    });

    it('[REGRESSION] sollte den Etagen-Label-Anker auf die vertikale MITTE der Etage setzen (Führungslinie deutet auf die Etage, nicht auf ihre Oberkante/Grenze)', () => {
      const model = makeModel();
      const subLayout = buildCityLayout(model, {
        level: 'subcategory',
        focusDistrictId: 'leisure',
        focusSubcategoryId: 'streaming',
      });
      const floors = subLayout.boxes.filter((b) => b.kind === 'floor');
      expect(floors.length).toBeGreaterThan(0);
      for (const floor of floors) {
        expect(floor.labelAnchor).toBeDefined();
        // Anker = Etagenmitte (nicht Oberkante center.y + size.y/2).
        expect(floor.labelAnchor!.y).toBeCloseTo(floor.center.y, 10);
        expect(floor.labelAnchor!.x).toBeCloseTo(floor.center.x, 10);
        expect(floor.labelAnchor!.z).toBeCloseTo(floor.center.z, 10);
      }
    });

    it('sollte andere Balken im selben Viertel bei aktivem Floor-Fokus dimmen (niedrigere opacity als auf district-Ebene)', () => {
      const model = makeModel();
      const districtLayout = buildCityLayout(model, { level: 'district', focusDistrictId: 'leisure' });
      const subLayout = buildCityLayout(model, {
        level: 'subcategory',
        focusDistrictId: 'leisure',
        focusSubcategoryId: 'streaming',
      });

      const districtDiningBar = districtLayout.boxes.find((b) => b.id === 'leisure/dining')!;
      const subDiningBar = subLayout.boxes.find((b) => b.id === 'leisure/dining')!;
      expect(subDiningBar.opacity).toBeLessThan(districtDiningBar.opacity);
    });

    it('[REGRESSION] sollte ein fokussiertes Gebäude OHNE Etagen voll sichtbar rendern (keine verwaschene Sackgasse)', () => {
      // Die meisten Unterkategorien haben keine erkannten wiederkehrenden
      // Verträge (im Fixture nur "Streaming & Abos"). Tauchte man in ein solches
      // Gebäude ein, fiel es früher auf BAR_OPACITY_DIMMED_SUBCATEGORY (wie ein
      // nicht-fokussierter Nachbar) zurück — das Eintauchen wirkte wie ein
      // toter, ausgewaschener Balken. Das fokussierte Gebäude selbst muss voll
      // sichtbar bleiben.
      const model = makeModel();
      const districtLayout = buildCityLayout(model, { level: 'district', focusDistrictId: 'leisure' });
      const subLayout = buildCityLayout(model, {
        level: 'subcategory',
        focusDistrictId: 'leisure',
        focusSubcategoryId: 'dining', // 'dining' hat keine contracts -> keine Etagen
      });

      // Kein Etagen-Split (Gebäude ohne Verträge).
      expect(subLayout.boxes.filter((b) => b.kind === 'floor')).toHaveLength(0);

      const focusedBar = subLayout.boxes.find((b) => b.id === 'leisure/dining')!;
      expect(focusedBar).toBeDefined();
      // Voll sichtbar — genauso wie beim Browsen auf Distrikt-Ebene ...
      const districtDiningBar = districtLayout.boxes.find((b) => b.id === 'leisure/dining')!;
      expect(focusedBar.opacity).toBe(districtDiningBar.opacity);
      // ... und deutlich sichtbarer als ein nicht-fokussierter (gedimmter) Nachbar.
      const neighborBar = subLayout.boxes.find((b) => b.id === 'leisure/shopping')!;
      expect(focusedBar.opacity).toBeGreaterThan(neighborBar.opacity);
    });
  });

  describe('Hülle umschließt alle Balken ihres Viertels', () => {
    it('sollte für jeden Distrikt eine Hülle liefern, die alle ihre Balken (x/z-Footprint und Höhe) vollständig umschließt', () => {
      const model = makeModel();
      const layout = buildCityLayout(model, { level: 'city' });

      for (const district of model.districts) {
        const hull = layout.boxes.find((b) => b.kind === 'hull' && b.id === district.id)!;
        expect(hull).toBeDefined();
        const bars = layout.boxes.filter((b) => b.kind === 'bar' && b.id.startsWith(`${district.id}/`));
        expect(bars.length).toBe(district.subcategories.length);

        const hullMinX = hull.center.x - hull.size.x / 2;
        const hullMaxX = hull.center.x + hull.size.x / 2;
        const hullMinZ = hull.center.z - hull.size.z / 2;
        const hullMaxZ = hull.center.z + hull.size.z / 2;
        const hullMaxY = hull.center.y + hull.size.y / 2;

        for (const bar of bars) {
          const barMinX = bar.center.x - bar.size.x / 2;
          const barMaxX = bar.center.x + bar.size.x / 2;
          const barMinZ = bar.center.z - bar.size.z / 2;
          const barMaxZ = bar.center.z + bar.size.z / 2;
          const barMaxY = bar.center.y + bar.size.y / 2;

          expect(barMinX).toBeGreaterThanOrEqual(hullMinX - 1e-9);
          expect(barMaxX).toBeLessThanOrEqual(hullMaxX + 1e-9);
          expect(barMinZ).toBeGreaterThanOrEqual(hullMinZ - 1e-9);
          expect(barMaxZ).toBeLessThanOrEqual(hullMaxZ + 1e-9);
          expect(barMaxY).toBeLessThanOrEqual(hullMaxY + 1e-9);
        }
      }
    });
  });

  describe('Hülle: konstanter Kopffreiheits-Anteil über dem höchsten Balken', () => {
    // Füllgrad = höchster Balken des Viertels / Hüllenhöhe. Bei PROPORTIONALER
    // Kopffreiheit (Anteil der Balkenhöhe statt festem additivem Abstand) ist
    // dieser Anteil für JEDES Viertel gleich — unabhängig von der Gebäudegröße.
    const fillRatio = (
      layout: ReturnType<typeof buildCityLayout>,
      districtId: string,
    ): number => {
      const hull = layout.boxes.find((b) => b.kind === 'hull' && b.id === districtId)!;
      const bars = layout.boxes.filter((b) => b.kind === 'bar' && b.id.startsWith(`${districtId}/`));
      const tallest = Math.max(...bars.map((b) => b.size.y));
      return tallest / hull.size.y;
    };

    it('sollte für JEDES Viertel denselben Balken-Füllanteil liefern (proportionale statt fester Kopffreiheit)', () => {
      const model = makeModel();
      const layout = buildCityLayout(model, { level: 'city' });
      const ratios = model.districts.map((d) => fillRatio(layout, d.id));
      for (const ratio of ratios) {
        expect(ratio).toBeCloseTo(ratios[0], 10);
      }
    });

    it('[REGRESSION] sollte ein kleines Viertel nicht mit unverhältnismäßig hoher Hülle strafen (kleiner Höchstbalken füllt seine Hülle genauso stark wie der größte der Stadt)', () => {
      const model = makeModel();
      const layout = buildCityLayout(model, { level: 'city' });
      // "housing" trägt den Stadt-Höchstbalken (Miete 980), "leisure" den
      // kleinsten Höchstbalken. Mit fester +0.6-Kopffreiheit füllte "leisure"
      // seine Hülle deutlich schwächer als "housing" (Nutzer-Befund: innerer
      // Balken wirkt klein); mit proportionaler Kopffreiheit sind beide gleich.
      expect(fillRatio(layout, 'leisure')).toBeCloseTo(fillRatio(layout, 'housing'), 10);
    });

    it('sollte die Hülle des Stadt-Höchstbalken-Viertels unverändert lassen (proportional == alt für den Höchstbalken)', () => {
      const model = makeModel();
      const layout = buildCityLayout(model, { level: 'city' });
      const housingHull = layout.boxes.find((b) => b.kind === 'hull' && b.id === 'housing')!;
      // Höchster Balken der Stadt = MAX_BAR_HEIGHT (6). Alte feste Kopffreiheit
      // 6 + 0.6 = 6.6; proportionale (10 %) 6 * 1.1 = 6.6 — bewusst identisch,
      // damit der Fix ausschließlich kleinere Gebäude betrifft.
      expect(housingHull.size.y).toBeCloseTo(6.6, 10);
    });
  });

  describe('Ziel-Hüllen (WP-D7, Hülle = Soll / Balken = Ist)', () => {
    const goalModel = (): CityModel => ({
      valueKind: 'progress',
      districts: [
        {
          id: 'goal:done',
          label: 'Erreichtes Ziel',
          color: '#f0b429',
          total: 1,
          targetAmount: 1,
          subcategories: [{ id: 'bar', label: 'Erreichtes Ziel', amount: 1 }],
        },
        {
          id: 'goal:half',
          label: 'Halbes Ziel',
          color: '#3b82f6',
          total: 0.5,
          targetAmount: 1,
          subcategories: [{ id: 'bar', label: 'Halbes Ziel', amount: 0.5 }],
        },
      ],
    });

    it('sollte die Hüllen-Höhe aus targetAmount ableiten (exakt, OHNE Kopffreiheits-Aufschlag) — der Füllgrad des Balkens IST der Fortschritt', () => {
      const layout = buildCityLayout(goalModel(), { level: 'city' });

      const doneHull = layout.boxes.find((b) => b.kind === 'hull' && b.id === 'goal:done')!;
      const halfHull = layout.boxes.find((b) => b.kind === 'hull' && b.id === 'goal:half')!;
      const doneBar = layout.boxes.find((b) => b.id === 'goal:done/bar')!;
      const halfBar = layout.boxes.find((b) => b.id === 'goal:half/bar')!;

      // Beide Ziele haben denselben SOLL-Wert -> exakt gleich hohe Hüllen.
      expect(doneHull.size.y).toBeCloseTo(halfHull.size.y, 10);
      // Erreichtes Ziel: Balken füllt die Hülle EXAKT (kein Kopffreiheits-Gap).
      expect(doneBar.size.y).toBeCloseTo(doneHull.size.y, 10);
      // Halbes Ziel: Füllgrad = sqrt-skaliertes Verhältnis, aber sicher < Hülle.
      expect(halfBar.size.y).toBeLessThan(halfHull.size.y);
      expect(halfBar.size.y).toBeGreaterThan(0);
    });

    it('sollte Distrikte OHNE targetAmount unverändert lassen (bestehende Kopffreiheits-Regel, kein Verhaltensbruch)', () => {
      const model = makeModel();
      const layout = buildCityLayout(model, { level: 'city' });
      const housingHull = layout.boxes.find((b) => b.kind === 'hull' && b.id === 'housing')!;
      // Bisheriges Verhalten: höchster Balken (6.0) * 1.1 Kopffreiheit = 6.6.
      expect(housingHull.size.y).toBeCloseTo(6.6, 10);
    });
  });

  describe('Seiten-Bänder (WP-D8, Übersicht: links | mitte | rechts)', () => {
    const overviewModel = (): CityModel => ({
      districts: [
        {
          id: 'inc-a',
          label: 'Gehalt',
          color: '#10b981',
          total: 3000,
          side: 'left',
          subcategories: [{ id: 'a', label: 'Arbeitgeber', amount: 3000 }],
        },
        {
          id: 'inc-b',
          label: 'Kapital',
          color: '#0d9488',
          total: 100,
          side: 'left',
          subcategories: [{ id: 'b', label: 'Broker', amount: 100 }],
        },
        {
          id: 'balance',
          label: 'Sparrate',
          color: '#f0b429',
          total: 900,
          side: 'center',
          subcategories: [{ id: 's', label: 'Sparrate', amount: 900 }],
        },
        {
          id: 'exp-a',
          label: 'Wohnen',
          color: '#f0563c',
          total: 1500,
          side: 'right',
          subcategories: [{ id: 'w', label: 'Miete', amount: 1500 }],
        },
        {
          id: 'exp-b',
          label: 'Freizeit',
          color: '#3b82f6',
          total: 600,
          side: 'right',
          subcategories: [{ id: 'f', label: 'Hobbys', amount: 600 }],
        },
      ],
    });

    it('sollte links-, mittel- und rechts-Distrikte in getrennten, nicht überlappenden Bändern platzieren (links < mitte < rechts)', () => {
      const layout = buildCityLayout(overviewModel(), { level: 'city' });
      const plotX = (id: string) => {
        const plot = layout.boxes.find((b) => b.kind === 'plot' && b.id === `${id}:plot`)!;
        return { min: plot.center.x - plot.size.x / 2, max: plot.center.x + plot.size.x / 2 };
      };

      const leftMax = Math.max(plotX('inc-a').max, plotX('inc-b').max);
      const centerMin = plotX('balance').min;
      const centerMax = plotX('balance').max;
      const rightMin = Math.min(plotX('exp-a').min, plotX('exp-b').min);

      expect(leftMax).toBeLessThan(centerMin);
      expect(centerMax).toBeLessThan(rightMin);
    });

    it('sollte alle Distrikte weiterhin auf dem gemeinsamen Boden platzieren und ein zusammenhängendes Layout liefern (Bounds > 0)', () => {
      const layout = buildCityLayout(overviewModel(), { level: 'city' });
      expect(layout.boxes.filter((b) => b.kind === 'plot')).toHaveLength(5);
      expect(layout.boxes.filter((b) => b.kind === 'ground')).toHaveLength(1);
      expect(layout.boundingRadius).toBeGreaterThan(0);
    });
  });

  describe('Pickable-Matrix je Level', () => {
    it('sollte auf city-Ebene nur Hüllen pickable machen', () => {
      const model = makeModel();
      const layout = buildCityLayout(model, { level: 'city' });
      const hulls = layout.boxes.filter((b) => b.kind === 'hull');
      const bars = layout.boxes.filter((b) => b.kind === 'bar');
      expect(hulls.length).toBeGreaterThan(0);
      expect(bars.length).toBeGreaterThan(0);
      expect(hulls.every((h) => h.pickable)).toBe(true);
      expect(bars.every((b) => !b.pickable)).toBe(true);
      expect(layout.boxes.filter((b) => b.kind === 'plot').every((p) => !p.pickable)).toBe(true);
      expect(layout.boxes.filter((b) => b.kind === 'ground').every((g) => !g.pickable)).toBe(true);
    });

    it('sollte auf district-Ebene nur Balken pickable machen', () => {
      const model = makeModel();
      const layout = buildCityLayout(model, { level: 'district', focusDistrictId: 'housing' });
      const hulls = layout.boxes.filter((b) => b.kind === 'hull');
      const bars = layout.boxes.filter((b) => b.kind === 'bar');
      expect(bars.length).toBeGreaterThan(0);
      expect(bars.every((b) => b.pickable)).toBe(true);
      expect(hulls.every((h) => !h.pickable)).toBe(true);
    });

    it('sollte auf subcategory-Ebene nur Etagen pickable machen', () => {
      const model = makeModel();
      const layout = buildCityLayout(model, {
        level: 'subcategory',
        focusDistrictId: 'leisure',
        focusSubcategoryId: 'streaming',
      });
      const floors = layout.boxes.filter((b) => b.kind === 'floor');
      const bars = layout.boxes.filter((b) => b.kind === 'bar');
      const hulls = layout.boxes.filter((b) => b.kind === 'hull');
      expect(floors.length).toBeGreaterThan(0);
      expect(floors.every((f) => f.pickable)).toBe(true);
      expect(bars.every((b) => !b.pickable)).toBe(true);
      expect(hulls.every((h) => !h.pickable)).toBe(true);
    });
  });

  describe('Kanten nur für Hüllen', () => {
    it('sollte edges nur bei kind "hull" auf true setzen', () => {
      const model = makeModel();
      const layout = buildCityLayout(model, { level: 'city' });
      for (const box of layout.boxes) {
        if (box.kind === 'hull') {
          expect(box.edges).toBe(true);
        } else {
          expect(box.edges).toBe(false);
        }
      }
    });
  });

  describe('Bounding-Radius / Zentrum', () => {
    it('sollte boundingRadius > 0 liefern', () => {
      const model = makeModel();
      const layout = buildCityLayout(model, { level: 'city' });
      expect(layout.boundingRadius).toBeGreaterThan(0);
    });

    it('sollte center.y > 0 liefern (Stadt wächst nach oben)', () => {
      const model = makeModel();
      const layout = buildCityLayout(model, { level: 'city' });
      expect(layout.center.y).toBeGreaterThan(0);
    });

    it('sollte auf jeder Ebene ein positives boundingRadius und center.y > 0 liefern', () => {
      const model = makeModel();
      const views = [
        { level: 'city' as const },
        { level: 'district' as const, focusDistrictId: 'mobility' },
        { level: 'subcategory' as const, focusDistrictId: 'leisure', focusSubcategoryId: 'streaming' },
      ];
      for (const view of views) {
        const layout = buildCityLayout(model, view);
        expect(layout.boundingRadius).toBeGreaterThan(0);
        expect(layout.center.y).toBeGreaterThan(0);
      }
    });
  });

  describe('Grundstücksgröße proportional zur Anzahl Unterkategorien', () => {
    it('sollte dem Distrikt mit mehr Unterkategorien (leisure, 5) ein größeres Grundstück geben als einem mit weniger (housing, 4)', () => {
      const model = makeModel();
      const layout = buildCityLayout(model, { level: 'city' });
      const leisurePlot = layout.boxes.find((b) => b.kind === 'plot' && b.id === 'leisure:plot')!;
      const housingPlot = layout.boxes.find((b) => b.kind === 'plot' && b.id === 'housing:plot')!;
      expect(leisurePlot).toBeDefined();
      expect(housingPlot).toBeDefined();
      expect(leisurePlot.size.x).toBeGreaterThan(housingPlot.size.x);
    });
  });

  describe('Edge Cases', () => {
    it('sollte bei leerem Modell ein Layout ohne Absturz liefern (nur ground, falls vorhanden)', () => {
      const layout = buildCityLayout({ districts: [] }, { level: 'city' });
      expect(layout.boxes.filter((b) => b.kind === 'bar')).toHaveLength(0);
      expect(layout.boxes.filter((b) => b.kind === 'hull')).toHaveLength(0);
    });
  });
});

describe('Etagen-Shading (WP-C8)', () => {
  it('sollte benachbarten Etagen desselben Gebäudes unterschiedliche Farben geben', () => {
    const model = makeModel();
    const layout = buildCityLayout(model, {
      level: 'subcategory',
      focusDistrictId: 'leisure',
      focusSubcategoryId: 'streaming',
    });
    const floors = layout.boxes.filter((b) => b.kind === 'floor');
    expect(floors.length).toBeGreaterThan(1);
    for (let i = 1; i < floors.length; i++) {
      expect(floors[i].color).not.toBe(floors[i - 1].color);
    }
  });

  it('sollte für alle Etagen gültige Hex-Farben liefern, abgeleitet von der Distrikt-Basisfarbe', () => {
    const model = makeModel();
    const layout = buildCityLayout(model, {
      level: 'subcategory',
      focusDistrictId: 'leisure',
      focusSubcategoryId: 'streaming',
    });
    const floors = layout.boxes.filter((b) => b.kind === 'floor');
    expect(floors.length).toBeGreaterThan(0);
    for (const floor of floors) {
      expect(floor.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('sollte bei identischem Input deterministisch dieselben Etagenfarben liefern', () => {
    const model = makeModel();
    const view = { level: 'subcategory' as const, focusDistrictId: 'leisure', focusSubcategoryId: 'streaming' };
    const colors1 = buildCityLayout(model, view)
      .boxes.filter((b) => b.kind === 'floor')
      .map((b) => b.color);
    const colors2 = buildCityLayout(model, view)
      .boxes.filter((b) => b.kind === 'floor')
      .map((b) => b.color);
    expect(colors1).toEqual(colors2);
  });
});

describe('computeFocusBounds', () => {
  describe('Happy Path', () => {
    it('sollte für einen Distrikt (city-Ebene) die BALKEN umfassen, NICHT die (breite, nahezu unsichtbare) Hülle', () => {
      const model = makeModel();
      const layout = buildCityLayout(model, { level: 'city' });

      const bounds = computeFocusBounds(layout, 'leisure');
      expect(bounds).not.toBeNull();

      // Alle Balken des Distrikts liegen innerhalb der Bounds.
      const bars = layout.boxes.filter((b) => b.kind === 'bar' && b.id.startsWith('leisure/'));
      expect(bars.length).toBeGreaterThan(0);
      for (const box of bars) {
        const dx = Math.abs(box.center.x - bounds!.center.x) + box.size.x / 2;
        const dy = Math.abs(box.center.y - bounds!.center.y) + box.size.y / 2;
        const dz = Math.abs(box.center.z - bounds!.center.z) + box.size.z / 2;
        const cornerDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        expect(cornerDistance).toBeLessThanOrEqual(bounds!.radius + 1e-9);
      }

      // Der Fokus-Radius ist ENGER als eine hüllen-inklusive Rahmung — sonst
      // rahmte die Kamera das leere Grundstück und die Balken wirkten zu klein
      // (Nutzer-Befund „Balken werden beim Eintauchen kleiner").
      const hull = layout.boxes.find((b) => b.id === 'leisure')!;
      expect(bounds!.radius).toBeLessThan(hull.size.x / 2 + hull.size.z / 2);

      // Andere Distrikte dürfen die Bounds NICHT vergrößern (nur "leisure" zählt).
      const housingHull = layout.boxes.find((b) => b.id === 'housing')!;
      const distanceToOtherDistrict = Math.hypot(
        housingHull.center.x - bounds!.center.x,
        housingHull.center.y - bounds!.center.y,
        housingHull.center.z - bounds!.center.z,
      );
      expect(distanceToOtherDistrict).toBeGreaterThan(bounds!.radius);
    });

    it('sollte für eine bereits in Etagen aufgelöste Unterkategorie (subcategory-Ebene) alle Etagen umfassen', () => {
      const model = makeModel();
      const layout = buildCityLayout(model, {
        level: 'subcategory',
        focusDistrictId: 'leisure',
        focusSubcategoryId: 'streaming',
      });

      const bounds = computeFocusBounds(layout, 'leisure/streaming');
      expect(bounds).not.toBeNull();

      const floors = layout.boxes.filter((b) => b.kind === 'floor');
      expect(floors.length).toBeGreaterThan(0);
      for (const floor of floors) {
        const distance = Math.hypot(
          floor.center.x - bounds!.center.x,
          floor.center.y - bounds!.center.y,
          floor.center.z - bounds!.center.z,
        );
        expect(distance).toBeLessThanOrEqual(bounds!.radius + 1e-9);
      }
    });
  });

  describe('Edge Cases', () => {
    it('sollte null liefern, wenn keine Box zur focusId passt', () => {
      const model = makeModel();
      const layout = buildCityLayout(model, { level: 'city' });
      expect(computeFocusBounds(layout, 'unknown-id')).toBeNull();
    });
  });
});
