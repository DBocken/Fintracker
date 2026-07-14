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
