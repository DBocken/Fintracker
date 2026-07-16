import { describe, it, expect } from 'vitest';
import { buildCityModelFromData } from '../city-data-adapter';
import type { SunburstNode, SunburstTree } from '@/lib/analysis-data';
import type { Category } from '@/types';
import type { CityContract } from '../city-model';

function mainNode(opts: { id: string; name: string; value: number; categoryId: string; children?: SunburstNode[] }): SunburstNode {
  return {
    id: opts.id,
    name: opts.name,
    value: opts.value,
    klasseId: 'diskretionaer',
    categoryId: opts.categoryId,
    children: opts.children ?? [],
  };
}

function subNode(opts: { id: string; name: string; value: number; categoryId: string }): SunburstNode {
  return { id: opts.id, name: opts.name, value: opts.value, klasseId: 'diskretionaer', categoryId: opts.categoryId, children: [] };
}

/** Baut einen einfachen Sunburst-Baum mit genau einer Klasse ("diskretionaer"), die die übergebenen Main-Knoten als Kinder trägt. */
function sunburstWithMains(mains: SunburstNode[]): SunburstTree {
  const total = mains.reduce((sum, m) => sum + m.value, 0);
  return {
    total,
    children: [
      { id: 'diskretionaer', name: 'Nicht-Essenziell', value: total, klasseId: 'diskretionaer', categoryId: null, children: mains },
    ],
  };
}

function category(id: string, name: string, overrides: Partial<Category> = {}): Category {
  return { id, name, filters: [], ...overrides };
}

/** Baut eine `floorsByBuilding`-Map (Gebäude-Id -> Etagen) aus `[buildingId, contracts][]` — Präzedenzfall `buildMerchantFloorsByBuilding`-Rückgabetyp. */
function floorsByBuilding(entries: [string, CityContract[]][]): Map<string, CityContract[]> {
  return new Map(entries);
}

describe('buildCityModelFromData', () => {
  describe('Distrikte aus Hauptkategorie-Knoten', () => {
    it('sollte Distrikte aus allen Hauptkategorie-Knoten über alle Klassen bilden, absteigend nach Betrag sortiert', () => {
      const housing = mainNode({ id: 'essenziell::housing', name: 'Wohnen', value: 1000, categoryId: 'housing' });
      const leisure = mainNode({ id: 'diskretionaer::leisure', name: 'Freizeit', value: 500, categoryId: 'leisure' });
      const tree: SunburstTree = {
        total: 1500,
        children: [
          { id: 'essenziell', name: 'Essenziell', value: 1000, klasseId: 'essenziell', categoryId: null, children: [housing] },
          { id: 'diskretionaer', name: 'Nicht-Essenziell', value: 500, klasseId: 'diskretionaer', categoryId: null, children: [leisure] },
        ],
      };
      const categoriesById = new Map<string, Category>([['housing', category('housing', 'Wohnen', { color: '#123456' })]]);

      const model = buildCityModelFromData(tree, categoriesById, new Map());

      expect(model.districts.map((d) => d.id)).toEqual(['housing', 'leisure']);
      expect(model.districts[0].total).toBe(1000);
      expect(model.districts[1].total).toBe(500);
    });

    it('sollte NICHT die (nahezu einheitliche) Kategorie-Farbe verwenden, sondern eine distinkte Stadt-Palette', () => {
      // Die Default-Taxonomie färbt fast alle Kategorien gleich petrol — als
      // Distrikt-Farbe wären die Viertel ununterscheidbar. Der Adapter ignoriert
      // `Category.color` daher bewusst zugunsten einer eigenen Palette.
      const a = mainNode({ id: 'x::a', name: 'A', value: 300, categoryId: 'a' });
      const b = mainNode({ id: 'x::b', name: 'B', value: 200, categoryId: 'b' });
      const categoriesById = new Map<string, Category>([
        ['a', category('a', 'A', { color: '#2e7d72' })],
        ['b', category('b', 'B', { color: '#2e7d72' })], // gleiche Kategorie-Farbe …
      ]);

      const model = buildCityModelFromData(sunburstWithMains([a, b]), categoriesById, new Map());

      // … aber die Distrikte müssen dennoch verschiedene Farben haben.
      expect(model.districts[0].color).not.toBe('#2e7d72');
      expect(model.districts[0].color).not.toBe(model.districts[1].color);
    });

    it('sollte distinkte, deterministische Distrikt-Farben je Index vergeben (verschiedene Viertel klar unterscheidbar)', () => {
      const a = mainNode({ id: 'x::a', name: 'A', value: 300, categoryId: 'a' });
      const b = mainNode({ id: 'x::b', name: 'B', value: 200, categoryId: 'b' });
      const c = mainNode({ id: 'x::c', name: 'C', value: 100, categoryId: 'c' });
      const model1 = buildCityModelFromData(sunburstWithMains([a, b, c]), new Map(), new Map());
      const model2 = buildCityModelFromData(sunburstWithMains([a, b, c]), new Map(), new Map());

      const colors = model1.districts.map((d) => d.color);
      colors.forEach((col) => expect(col).toMatch(/^#[0-9a-fA-F]{6}$/));
      // Alle drei paarweise verschieden.
      expect(new Set(colors).size).toBe(3);
      // Determinismus: identischer Input -> identische Farben.
      expect(model2.districts.map((d) => d.color)).toEqual(colors);
    });

    it('sollte Hauptkategorie-Knoten mit value <= 0 ignorieren', () => {
      const zero = mainNode({ id: 'x::zero', name: 'Null', value: 0, categoryId: 'zero' });
      const model = buildCityModelFromData(sunburstWithMains([zero]), new Map(), new Map());
      expect(model.districts).toHaveLength(0);
    });

    it('[REGRESSION] sollte dieselbe Hauptkategorie über mehrere Ausgabenklassen-Zweige zu EINEM Distrikt zusammenführen (keine doppelten Distrikt-IDs)', () => {
      // buildSunburstTree gruppiert primär nach der aus der ZUGEWIESENEN
      // (Unter-)Kategorie aufgelösten Ausgabenklasse; eine Unterkategorie darf
      // eine ANDERE Klasse haben als ihre Hauptkategorie (Default-Taxonomie,
      // z. B. 'Restaurants' diskretionär unter 'Lebensmittel' essenziell).
      // Bucht ein Nutzer sowohl direkt auf der Hauptkategorie als auch auf einer
      // abweichend klassifizierten Unterkategorie, erscheint dieselbe
      // `categoryId` unter ZWEI Klassen-Knoten. Früher erzeugte der Adapter
      // daraus zwei Distrikte mit identischer id (React-Key-Kollision, per
      // `find`/Map unerreichbare Gebäude, verworfene Vertrags-Etagen).
      const essenziellBranch = mainNode({ id: 'essenziell::food', name: 'Lebensmittel', value: 400, categoryId: 'food' });
      const restaurant = subNode({ id: 'diskretionaer::food::restaurant', name: 'Restaurants', value: 150, categoryId: 'restaurant' });
      const diskretionaerBranch = mainNode({ id: 'diskretionaer::food', name: 'Lebensmittel', value: 150, categoryId: 'food', children: [restaurant] });
      const tree: SunburstTree = {
        total: 550,
        children: [
          { id: 'essenziell', name: 'Essenziell', value: 400, klasseId: 'essenziell', categoryId: null, children: [essenziellBranch] },
          { id: 'diskretionaer', name: 'Nicht-Essenziell', value: 150, klasseId: 'diskretionaer', categoryId: null, children: [diskretionaerBranch] },
        ],
      };

      const model = buildCityModelFromData(tree, new Map(), new Map());

      // Genau EIN Distrikt 'food' — keine doppelte id.
      expect(model.districts).toHaveLength(1);
      expect(model.districts.filter((d) => d.id === 'food')).toHaveLength(1);
      // Beträge beider Klassen-Zweige zusammengeführt.
      expect(model.districts[0].total).toBe(550);
      // Beide Gebäude erreichbar: das Direkt-Gebäude (id = Hauptkategorie) UND
      // das abweichend klassifizierte Unterkategorie-Gebäude.
      expect(model.districts[0].subcategories.map((s) => s.id).sort()).toEqual(['food', 'restaurant']);
      expect(model.districts[0].subcategories.find((s) => s.id === 'food')?.amount).toBe(400);
      expect(model.districts[0].subcategories.find((s) => s.id === 'restaurant')?.amount).toBe(150);
    });
  });

  describe('Gebäude (Unterkategorien)', () => {
    it('sollte für einen Main OHNE Unterkategorien genau ein synthetisches Gebäude mit dem vollen Hauptkategorie-Betrag anlegen', () => {
      const main = mainNode({ id: 'x::fuel', name: 'Tanken', value: 200, categoryId: 'fuel' });
      const model = buildCityModelFromData(sunburstWithMains([main]), new Map(), new Map());

      expect(model.districts[0].subcategories).toHaveLength(1);
      expect(model.districts[0].subcategories[0]).toMatchObject({ id: 'fuel', label: 'Tanken', amount: 200 });
    });

    it('sollte für einen Main MIT Unterkategorien je Kind (inkl. synthetischem "Ohne Unterkategorie"-Knoten) ein Gebäude anlegen', () => {
      const sub = subNode({ id: 'x::leisure::streaming', name: 'Streaming', value: 30, categoryId: 'streaming' });
      const direct = subNode({ id: 'x::leisure::__direct', name: 'Ohne Unterkategorie', value: 10, categoryId: 'leisure' });
      const main = mainNode({ id: 'x::leisure', name: 'Freizeit', value: 40, categoryId: 'leisure', children: [sub, direct] });

      const model = buildCityModelFromData(sunburstWithMains([main]), new Map(), new Map());

      expect(model.districts[0].subcategories.map((s) => ({ id: s.id, label: s.label, amount: s.amount }))).toEqual([
        { id: 'streaming', label: 'Streaming', amount: 30 },
        { id: 'leisure', label: 'Ohne Unterkategorie', amount: 10 },
      ]);
    });
  });

  describe('Etagen (Händler-Aggregation, WP-E2)', () => {
    it('sollte Etagen aus der floorsByBuilding-Map im richtigen Gebäude (Unterkategorie) einordnen', () => {
      const sub = subNode({ id: 'x::leisure::streaming', name: 'Streaming', value: 30, categoryId: 'streaming' });
      const main = mainNode({ id: 'x::leisure', name: 'Freizeit', value: 30, categoryId: 'leisure', children: [sub] });
      const netflix: CityContract = { id: 'netflix', label: 'Netflix', amount: 17.99 };
      const spotify: CityContract = { id: 'spotify', label: 'Spotify', amount: 9.99 };

      const model = buildCityModelFromData(
        sunburstWithMains([main]),
        new Map(),
        floorsByBuilding([['streaming', [netflix, spotify]]]),
      );

      const streamingBuilding = model.districts[0].subcategories.find((s) => s.id === 'streaming')!;
      expect(streamingBuilding.contracts).toEqual([netflix, spotify]);
    });

    it('sollte Etagen OHNE Unterkategorie im Direkt-Gebäude (Hauptkategorie selbst) einordnen', () => {
      const main = mainNode({ id: 'x::fuel', name: 'Tanken', value: 60, categoryId: 'fuel' });
      const shell: CityContract = { id: 'shell', label: 'Shell', amount: 60 };

      const model = buildCityModelFromData(sunburstWithMains([main]), new Map(), floorsByBuilding([['fuel', [shell]]]));

      expect(model.districts[0].subcategories[0].contracts).toEqual([shell]);
    });

    it('[REGRESSION] sollte eine einzelne, nicht wiederkehrende Buchung (z. B. Aldi, 1x) als eigene, beschriftete Etage aufnehmen', () => {
      // Nutzer-Befund: die alte, auf `computeContracts` basierende Etagen-
      // Ableitung überspringt Händler mit weniger als `minCount` Buchungen —
      // eine einzelne Aldi-Buchung wurde dadurch NIE eine Etage. Der Adapter
      // selbst kennt keine Mindestanzahl mehr: er hängt einfach an, was
      // `floorsByBuilding` liefert (die Deckelungs-/Aggregationslogik liegt in
      // `buildMerchantFloorsByBuilding`, hier wird nur die Verdrahtung geprüft).
      const main = mainNode({ id: 'x::fuel', name: 'Tanken', value: 8.5, categoryId: 'fuel' });
      const aldi: CityContract = { id: 'aldi', label: 'Aldi', amount: 8.5 };

      const model = buildCityModelFromData(sunburstWithMains([main]), new Map(), floorsByBuilding([['fuel', [aldi]]]));

      expect(model.districts[0].subcategories[0].contracts).toEqual([aldi]);
    });

    it('sollte ein Gebäude ohne Eintrag in der Map ohne Etagen lassen (kein Crash)', () => {
      const main = mainNode({ id: 'x::leisure', name: 'Freizeit', value: 30, categoryId: 'leisure' });

      expect(() => buildCityModelFromData(sunburstWithMains([main]), new Map(), new Map())).not.toThrow();
      const model = buildCityModelFromData(sunburstWithMains([main]), new Map(), new Map());
      expect(model.districts[0].subcategories[0].contracts).toBeUndefined();
    });

    it('sollte eine LEERE Etagen-Liste für ein Gebäude NICHT als `contracts` anhängen', () => {
      const main = mainNode({ id: 'x::leisure', name: 'Freizeit', value: 30, categoryId: 'leisure' });

      const model = buildCityModelFromData(sunburstWithMains([main]), new Map(), floorsByBuilding([['leisure', []]]));

      expect(model.districts[0].subcategories[0].contracts).toBeUndefined();
    });

    it('sollte Etagen für ein Gebäude, das im Sunburst gar nicht vorkommt, ignorieren (kein passendes Gebäude gebaut)', () => {
      const main = mainNode({ id: 'x::leisure', name: 'Freizeit', value: 30, categoryId: 'leisure' });
      const orphan: CityContract = { id: 'orphan', label: 'Unbekannter Laden', amount: 20 };

      const model = buildCityModelFromData(
        sunburstWithMains([main]),
        new Map(),
        floorsByBuilding([['not-in-sunburst', [orphan]]]),
      );

      expect(model.districts[0].subcategories[0].contracts).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('sollte bei leerem Sunburst ein leeres Modell liefern', () => {
      const model = buildCityModelFromData({ total: 0, children: [] }, new Map(), new Map());
      expect(model).toEqual({ districts: [] });
    });
  });
});
