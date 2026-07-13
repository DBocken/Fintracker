import { describe, it, expect } from 'vitest';
import { buildCityModelFromData } from '../city-data-adapter';
import type { SunburstNode, SunburstTree } from '@/lib/analysis-data';
import type { ContractRow } from '@/components/contracts/contract-types';
import type { Category } from '@/types';

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

function contractRow(opts: {
  key: string;
  payee: string;
  categoryId: string;
  amountTypical: number;
  amountRecentTypical?: number;
  cycle?: ContractRow['cycle'];
  status?: ContractRow['status'];
  stale?: boolean;
  cycleKnown?: boolean;
}): ContractRow {
  return {
    key: opts.key,
    type: 'Ausgabe',
    payee: opts.payee,
    categoryName: opts.payee,
    categoryId: opts.categoryId,
    amountTypical: opts.amountTypical,
    amountRecentTypical: opts.amountRecentTypical,
    amountLast: opts.amountTypical,
    cycle: opts.cycle ?? 'Monatlich',
    lastDateISO: '2026-06-01',
    firstDateISO: '2026-01-01',
    nextDateISO: null,
    changed: false,
    changeAmount: 0,
    changeSinceLabel: null,
    confirmed: true,
    transactionIds: [],
    fingerprint: opts.key,
    status: opts.status ?? 'active',
    stale: opts.stale ?? false,
    cycleKnown: opts.cycleKnown ?? true,
  };
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

      const model = buildCityModelFromData(tree, categoriesById, []);

      expect(model.districts.map((d) => d.id)).toEqual(['housing', 'leisure']);
      expect(model.districts[0].total).toBe(1000);
      expect(model.districts[1].total).toBe(500);
    });

    it('sollte die Farbe der Kategorie übernehmen, wenn gesetzt', () => {
      const main = mainNode({ id: 'x::housing', name: 'Wohnen', value: 100, categoryId: 'housing' });
      const categoriesById = new Map<string, Category>([['housing', category('housing', 'Wohnen', { color: '#abcdef' })]]);

      const model = buildCityModelFromData(sunburstWithMains([main]), categoriesById, []);

      expect(model.districts[0].color).toBe('#abcdef');
    });

    it('sollte eine deterministische Fallback-Farbe je Distrikt-Index verwenden, wenn die Kategorie keine Farbe hat', () => {
      const a = mainNode({ id: 'x::a', name: 'A', value: 300, categoryId: 'a' });
      const b = mainNode({ id: 'x::b', name: 'B', value: 200, categoryId: 'b' });
      const model1 = buildCityModelFromData(sunburstWithMains([a, b]), new Map(), []);
      const model2 = buildCityModelFromData(sunburstWithMains([a, b]), new Map(), []);

      expect(model1.districts[0].color).toMatch(/^#/);
      expect(model1.districts[1].color).toMatch(/^#/);
      expect(model1.districts[0].color).not.toBe(model1.districts[1].color);
      // Determinismus: zweiter Lauf mit identischem Input liefert dieselben Fallback-Farben.
      expect(model2.districts.map((d) => d.color)).toEqual(model1.districts.map((d) => d.color));
    });

    it('sollte Hauptkategorie-Knoten mit value <= 0 ignorieren', () => {
      const zero = mainNode({ id: 'x::zero', name: 'Null', value: 0, categoryId: 'zero' });
      const model = buildCityModelFromData(sunburstWithMains([zero]), new Map(), []);
      expect(model.districts).toHaveLength(0);
    });
  });

  describe('Gebäude (Unterkategorien)', () => {
    it('sollte für einen Main OHNE Unterkategorien genau ein synthetisches Gebäude mit dem vollen Hauptkategorie-Betrag anlegen', () => {
      const main = mainNode({ id: 'x::fuel', name: 'Tanken', value: 200, categoryId: 'fuel' });
      const model = buildCityModelFromData(sunburstWithMains([main]), new Map(), []);

      expect(model.districts[0].subcategories).toHaveLength(1);
      expect(model.districts[0].subcategories[0]).toMatchObject({ id: 'fuel', label: 'Tanken', amount: 200 });
    });

    it('sollte für einen Main MIT Unterkategorien je Kind (inkl. synthetischem "Ohne Unterkategorie"-Knoten) ein Gebäude anlegen', () => {
      const sub = subNode({ id: 'x::leisure::streaming', name: 'Streaming', value: 30, categoryId: 'streaming' });
      const direct = subNode({ id: 'x::leisure::__direct', name: 'Ohne Unterkategorie', value: 10, categoryId: 'leisure' });
      const main = mainNode({ id: 'x::leisure', name: 'Freizeit', value: 40, categoryId: 'leisure', children: [sub, direct] });

      const model = buildCityModelFromData(sunburstWithMains([main]), new Map(), []);

      expect(model.districts[0].subcategories.map((s) => ({ id: s.id, label: s.label, amount: s.amount }))).toEqual([
        { id: 'streaming', label: 'Streaming', amount: 30 },
        { id: 'leisure', label: 'Ohne Unterkategorie', amount: 10 },
      ]);
    });
  });

  describe('Etagen (Verträge)', () => {
    it('sollte einen aktiven Vertrag mit Unterkategorie als Etage im richtigen Gebäude einordnen', () => {
      const sub = subNode({ id: 'x::leisure::streaming', name: 'Streaming', value: 30, categoryId: 'streaming' });
      const main = mainNode({ id: 'x::leisure', name: 'Freizeit', value: 30, categoryId: 'leisure', children: [sub] });
      const categoriesById = new Map<string, Category>([
        ['leisure', category('leisure', 'Freizeit')],
        ['streaming', category('streaming', 'Streaming', { parent_id: 'leisure' })],
      ]);
      const netflix = contractRow({ key: 'netflix', payee: 'Netflix', categoryId: 'streaming', amountTypical: 17.99 });

      const model = buildCityModelFromData(sunburstWithMains([main]), categoriesById, [netflix]);

      const streamingBuilding = model.districts[0].subcategories.find((s) => s.id === 'streaming')!;
      expect(streamingBuilding.contracts).toEqual([{ id: 'netflix', label: 'Netflix', amount: 17.99 }]);
    });

    it('sollte einen aktiven Vertrag OHNE Unterkategorie im Direkt-Gebäude (Hauptkategorie selbst) einordnen', () => {
      const main = mainNode({ id: 'x::fuel', name: 'Tanken', value: 100, categoryId: 'fuel' });
      const categoriesById = new Map<string, Category>([['fuel', category('fuel', 'Tanken')]]);
      const shell = contractRow({ key: 'shell', payee: 'Shell', categoryId: 'fuel', amountTypical: 60 });

      const model = buildCityModelFromData(sunburstWithMains([main]), categoriesById, [shell]);

      expect(model.districts[0].subcategories[0].contracts).toEqual([{ id: 'shell', label: 'Shell', amount: 60 }]);
    });

    it('[REGRESSION] sollte einen noch nicht bestätigten Kandidaten (z. B. frisch kategorisiertes Netflix/Spotify) als Etage übernehmen', () => {
      // Nutzer-Befund „Streaming wird nicht korrekt erkannt": nach dem Zuweisen
      // der Kategorie sind die erkannten Abos `candidate` (nicht `active`) —
      // sie MÜSSEN trotzdem Etagen werden, sonst bleibt das Gebäude leer.
      const sub = subNode({ id: 'x::leisure::streaming', name: 'Streaming', value: 24, categoryId: 'streaming' });
      const main = mainNode({ id: 'x::leisure', name: 'Freizeit', value: 24, categoryId: 'leisure', children: [sub] });
      const categoriesById = new Map<string, Category>([
        ['leisure', category('leisure', 'Freizeit')],
        ['streaming', category('streaming', 'Streaming', { parent_id: 'leisure' })],
      ]);
      const netflix = contractRow({ key: 'nf', payee: 'Netflix', categoryId: 'streaming', amountTypical: 13, status: 'candidate' });
      const spotify = contractRow({ key: 'sp', payee: 'Spotify', categoryId: 'streaming', amountTypical: 11, status: 'candidate' });

      const model = buildCityModelFromData(sunburstWithMains([main]), categoriesById, [netflix, spotify]);

      const building = model.districts[0].subcategories.find((s) => s.id === 'streaming')!;
      expect(building.contracts?.map((c) => c.label)).toEqual(['Netflix', 'Spotify']);
    });

    it('sollte verworfene/beendete/veraltete/zyklus-unbekannte Einträge NICHT als Etage übernehmen', () => {
      const sub = subNode({ id: 'x::leisure::streaming', name: 'Streaming', value: 30, categoryId: 'streaming' });
      const main = mainNode({ id: 'x::leisure', name: 'Freizeit', value: 30, categoryId: 'leisure', children: [sub] });
      const categoriesById = new Map<string, Category>([
        ['leisure', category('leisure', 'Freizeit')],
        ['streaming', category('streaming', 'Streaming', { parent_id: 'leisure' })],
      ]);
      const rejected = contractRow({ key: 'c0', payee: 'Verworfen', categoryId: 'streaming', amountTypical: 5, status: 'rejected' });
      const ended = contractRow({ key: 'c1', payee: 'Beendet', categoryId: 'streaming', amountTypical: 5, status: 'ended' });
      const stale = contractRow({ key: 'c2', payee: 'Veraltet', categoryId: 'streaming', amountTypical: 5, stale: true });
      const unknownCycle = contractRow({ key: 'c3', payee: 'Unbekannt', categoryId: 'streaming', amountTypical: 5, cycle: 'Unbekannt', cycleKnown: false });

      const model = buildCityModelFromData(sunburstWithMains([main]), categoriesById, [rejected, ended, stale, unknownCycle]);

      const building = model.districts[0].subcategories.find((s) => s.id === 'streaming')!;
      expect(building.contracts).toBeUndefined();
    });

    it('sollte einen Vertrag ohne auflösbares Gebäude überspringen statt abzustürzen', () => {
      const main = mainNode({ id: 'x::leisure', name: 'Freizeit', value: 30, categoryId: 'leisure' });
      const orphan = contractRow({ key: 'orphan', payee: 'Unbekannter Laden', categoryId: 'not-in-sunburst', amountTypical: 20 });

      expect(() => buildCityModelFromData(sunburstWithMains([main]), new Map(), [orphan])).not.toThrow();
      const model = buildCityModelFromData(sunburstWithMains([main]), new Map(), [orphan]);
      expect(model.districts[0].subcategories[0].contracts).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('sollte bei leerem Sunburst ein leeres Modell liefern', () => {
      const model = buildCityModelFromData({ total: 0, children: [] }, new Map(), []);
      expect(model).toEqual({ districts: [] });
    });
  });
});
