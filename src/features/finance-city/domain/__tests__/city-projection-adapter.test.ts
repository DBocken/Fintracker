import { describe, it, expect } from 'vitest';
import { buildCityModelFromProjection } from '../city-projection-adapter';
import { buildCityLayout } from '../city-layout';
import type { Category } from '@/types';

/**
 * WP-5.2 — der Zukunftsmonat ist dieselbe Stadt, nur mit anderen Höhen.
 *
 * Prognostiziert wird hier NICHTS: der Adapter bekommt fertige Beträge je
 * Kategorie aus `@/lib/forecast-category-projection` und ordnet sie der
 * Hierarchie zu.
 */
function cat(id: string, name: string, parentId?: string): Category {
  return { id, name, filters: [], parent_id: parentId } as unknown as Category;
}

const CATS = new Map<string, Category>([
  ['wohnen', cat('wohnen', 'Wohnen')],
  ['miete', cat('miete', 'Miete', 'wohnen')],
  ['strom', cat('strom', 'Strom', 'wohnen')],
  ['freizeit', cat('freizeit', 'Freizeit')],
  ['streaming', cat('streaming', 'Streaming', 'freizeit')],
]);

describe('buildCityModelFromProjection', () => {
  it('sollte das Modell als Prognose kennzeichnen', () => {
    const model = buildCityModelFromProjection(new Map([['miete', 800]]), CATS);
    expect(model.projected).toBe(true);
  });

  it('sollte Gebäude ihrer Hauptkategorie als Distrikt zuordnen', () => {
    const model = buildCityModelFromProjection(
      new Map([
        ['miete', 800],
        ['strom', 90],
        ['streaming', 30],
      ]),
      CATS,
    );

    expect(model.districts.map((d) => d.id)).toEqual(['wohnen', 'freizeit']);
    const wohnen = model.districts[0];
    expect(wohnen.total).toBeCloseTo(890, 10);
    expect(wohnen.subcategories.map((s) => s.id)).toEqual(['miete', 'strom']);
  });

  it('sollte Distrikte nach Betrag absteigend sortieren', () => {
    const model = buildCityModelFromProjection(
      new Map([
        ['streaming', 500],
        ['miete', 100],
      ]),
      CATS,
    );
    expect(model.districts.map((d) => d.id)).toEqual(['freizeit', 'wohnen']);
  });

  it('sollte die Farbe des Ist-Modells übernehmen', () => {
    // Sonst fiele die Zukunft farblich aus der Reihe und die Stadt wäre beim
    // Monatswechsel nicht mehr als dieselbe erkennbar.
    const colors = new Map([['wohnen', '#14b8a6']]);
    const model = buildCityModelFromProjection(new Map([['miete', 800]]), CATS, {
      colorByDistrictId: colors,
    });
    expect(model.districts[0].color).toBe('#14b8a6');
  });

  it('sollte für unbekannte Distrikte eine Ersatzfarbe verwenden statt zu scheitern', () => {
    const model = buildCityModelFromProjection(new Map([['miete', 800]]), CATS, {
      colorByDistrictId: new Map(),
    });
    expect(model.districts[0].color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('[REGRESSION] sollte nicht auflösbare Kategorien überspringen statt sie zu erfinden', () => {
    // Eine gelöschte Kategorie darf keinen Distrikt unter einer erfundenen Id
    // erzeugen — dieselbe Regel wie im Ist-Adapter.
    const model = buildCityModelFromProjection(
      new Map([
        ['miete', 800],
        ['geloescht', 500],
      ]),
      CATS,
    );

    expect(model.districts).toHaveLength(1);
    expect(model.districts[0].id).toBe('wohnen');
  });

  it('sollte Nullbeträge und negative Werte überspringen', () => {
    const model = buildCityModelFromProjection(
      new Map([
        ['miete', 0],
        ['strom', -5],
        ['streaming', 30],
      ]),
      CATS,
    );
    expect(model.districts.map((d) => d.id)).toEqual(['freizeit']);
  });

  it('sollte ohne Prognose ein leeres Modell liefern', () => {
    const model = buildCityModelFromProjection(new Map(), CATS);
    expect(model.districts).toEqual([]);
    expect(model.projected).toBe(true);
  });

  it('sollte keine Etagen, keine Aktivität und keine Wiederkehr erfinden', () => {
    // Die Prognose kennt Kategorien, keine Händler und keine Buchungsfrequenz.
    // Etagen oder Fassaden-Aktivität zu erzeugen hieße, Zahlen auf eine
    // Genauigkeit zu bringen, die es nicht gibt.
    const model = buildCityModelFromProjection(new Map([['miete', 800]]), CATS);
    const building = model.districts[0].subcategories[0];

    expect(building.contracts).toBeUndefined();
    expect(building.activity).toBeUndefined();
    expect(building.recurringAmount).toBeUndefined();
  });

  it('sollte eine direkt auf der Hauptkategorie gebuchte Prognose als eigenes Gebäude führen', () => {
    // Gleiche Konvention wie im Ist-Adapter: Gebäude-Id = `subId ?? mainId`.
    const model = buildCityModelFromProjection(new Map([['wohnen', 200]]), CATS);
    expect(model.districts[0].subcategories.map((s) => s.id)).toEqual(['wohnen']);
  });
});

describe('Prognose-Darstellung im Layout (WP-5.2)', () => {
  const PROJECTION = new Map([
    ['miete', 800],
    ['strom', 90],
  ]);

  it('sollte Prognose-Baukörper durchscheinend und mit Kante zeichnen', () => {
    // Dieselbe Bildsprache, die die Stadt schon für „noch nicht erreicht"
    // nutzt (die Ziel-Hülle im Ziele-Tab) — erkennbar, ohne das Datum zu lesen.
    const projected = buildCityModelFromProjection(PROJECTION, CATS);
    const actual = { ...projected, projected: false };
    const view = { level: 'district', focusDistrictId: 'wohnen' } as const;

    const projectedBar = buildCityLayout(projected, view).boxes.find((b) => b.id === 'wohnen/miete')!;
    const actualBar = buildCityLayout(actual, view).boxes.find((b) => b.id === 'wohnen/miete')!;

    expect(projectedBar.opacity).toBeLessThan(actualBar.opacity);
    expect(projectedBar.edges).toBe(true);
    expect(actualBar.edges).toBe(false);
  });

  it('[REGRESSION] sollte die Deckkraft nur senken, nie anheben', () => {
    // Ein ohnehin gedimmter Nachbar darf in der Prognose nicht plötzlich
    // präsenter sein als im Ist-Monat.
    const projected = buildCityModelFromProjection(PROJECTION, CATS);
    const actual = { ...projected, projected: false };
    const view = { level: 'subcategory', focusDistrictId: 'wohnen', focusSubcategoryId: 'strom' } as const;

    const bars = (model: typeof projected) =>
      buildCityLayout(model, view)
        .boxes.filter((b) => b.kind === 'bar')
        .map((b) => b.opacity);

    const projectedOpacities = bars(projected);
    const actualOpacities = bars(actual);
    expect(projectedOpacities).toHaveLength(actualOpacities.length);
    for (const [index, opacity] of projectedOpacities.entries()) {
      expect(opacity).toBeLessThanOrEqual(actualOpacities[index]);
    }
  });

  it('sollte dieselbe Geometrie liefern wie ein Ist-Monat', () => {
    // Der Monatswechsel soll die Stadt UMBAUEN, nicht neu erfinden: gleiche
    // Grundstücke, gleiche Positionen, nur andere Höhen/Deckkraft.
    const projected = buildCityModelFromProjection(PROJECTION, CATS);
    const actual = { ...projected, projected: false };
    const view = { level: 'city' } as const;

    expect(buildCityLayout(projected, view).boxes.map((b) => b.id)).toEqual(
      buildCityLayout(actual, view).boxes.map((b) => b.id),
    );
  });
});
