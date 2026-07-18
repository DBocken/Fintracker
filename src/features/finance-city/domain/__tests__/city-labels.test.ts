import { describe, it, expect } from 'vitest';
import { selectCityLabels, resolveLabelCollisions } from '../city-labels';
import { buildCityLayout } from '../city-layout';
import type { CityModel } from '../city-model';

function makeModel(): CityModel {
  return {
    districts: [
      {
        id: 'housing',
        label: 'Wohnen',
        color: '#1d5c54',
        total: 980 + 89,
        subcategories: [
          { id: 'rent', label: 'Miete', amount: 980 },
          { id: 'utilities', label: 'Nebenkosten', amount: 89 },
        ],
      },
      {
        id: 'leisure',
        label: 'Freizeit',
        color: '#7d6b8a',
        total: 40 + 39.97,
        subcategories: [
          { id: 'hobbies', label: 'Hobbys', amount: 40 },
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
    ],
  };
}

describe('selectCityLabels', () => {
  it('sollte auf Stadt-Ebene ein Label je Distrikt liefern, nach Betrag absteigend sortiert', () => {
    const model = makeModel();
    const layout = buildCityLayout(model, { level: 'city' });

    const labels = selectCityLabels(model, layout, 'city');

    expect(labels).toHaveLength(2);
    expect(labels.map((l) => l.id)).toEqual(['housing', 'leisure']); // 1069 > 79.97
    expect(labels[0]).toMatchObject({ text: 'Wohnen', amount: 980 + 89, priority: 980 + 89 });
    expect(labels[0].anchor).toBeDefined();
  });

  it('sollte auf Distrikt-Ebene ein Label je Unterkategorie-Balken liefern (Name + Betrag aus dem Model)', () => {
    const model = makeModel();
    const layout = buildCityLayout(model, { level: 'district', focusDistrictId: 'leisure' });

    const labels = selectCityLabels(model, layout, 'district');

    expect(labels).toHaveLength(2);
    // hobbies (40) > streaming (39.97)
    expect(labels[0]).toMatchObject({ id: 'leisure/hobbies', text: 'Hobbys', amount: 40 });
    expect(labels[1]).toMatchObject({ id: 'leisure/streaming', text: 'Streaming & Abos', amount: 39.97 });
  });

  it('sollte auf Unterkategorie-Ebene (aufgelöster Vertrags-Balken) ein Label je Etage/Vertrag liefern', () => {
    const model = makeModel();
    const layout = buildCityLayout(model, {
      level: 'subcategory',
      focusDistrictId: 'leisure',
      focusSubcategoryId: 'streaming',
    });

    const labels = selectCityLabels(model, layout, 'subcategory');

    // Nur Etagen der AUFGELÖSTEN Unterkategorie ("streaming") — 'hobbies'
    // bleibt ein gedimmter Balken (kein 'floor'), erscheint hier NICHT.
    expect(labels).toHaveLength(4);
    expect(labels.map((l) => l.id)).toEqual([
      'leisure/streaming/netflix',
      'leisure/streaming/spotify',
      'leisure/streaming/hbo',
      'leisure/streaming/apple_tv',
    ]);
    expect(labels[0]).toMatchObject({ text: 'Netflix', amount: 17.99 });
  });

  it('sollte jedem Etagen-Label die (schattierte) Farbe seiner Etagen-Box mitgeben (für die farbige Führungslinie, WP-D2)', () => {
    const model = makeModel();
    const view = {
      level: 'subcategory' as const,
      focusDistrictId: 'leisure',
      focusSubcategoryId: 'streaming',
    };
    const layout = buildCityLayout(model, view);
    const floors = layout.boxes.filter((b) => b.kind === 'floor');
    const labels = selectCityLabels(model, layout, 'subcategory');

    expect(labels).toHaveLength(floors.length);
    for (const label of labels) {
      const floor = floors.find((f) => f.id === label.id)!;
      expect(floor).toBeDefined();
      // Label trägt exakt die (pro Etage schattierte) Boxfarbe.
      expect(label.color).toBe(floor.color);
      expect(label.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('sollte jedem Label den Anteil an der Gesamtausgabe (Summe aller Distrikt-Totale) mitgeben', () => {
    const model = makeModel();
    const layout = buildCityLayout(model, { level: 'city' });
    const labels = selectCityLabels(model, layout, 'city');

    // Gesamtausgabe (Cent) = housing (1069,00) + leisure (79,97) = 1148,97 €.
    const cityTotalMinor = 106900 + 7997;
    const housing = labels.find((l) => l.id === 'housing')!;
    const leisure = labels.find((l) => l.id === 'leisure')!;
    expect(housing.share).toBeCloseTo(106900 / cityTotalMinor, 10);
    expect(leisure.share).toBeCloseTo(7997 / cityTotalMinor, 10);
    // Anteile summieren sich (bis auf Rundung) zu 1.
    expect((housing.share ?? 0) + (leisure.share ?? 0)).toBeCloseTo(1, 10);
  });

  it('sollte share weglassen, wenn die Gesamtausgabe 0 ist (kein Division-durch-0)', () => {
    const model: CityModel = {
      districts: [{ id: 'x', label: 'X', color: '#000000', total: 0, subcategories: [{ id: 'y', label: 'Y', amount: 0 }] }],
    };
    const layout = buildCityLayout(model, { level: 'city' });
    const labels = selectCityLabels(model, layout, 'city');
    // Degenerierter Nullbetrag-Distrikt liefert ggf. gar kein Label (Nullbox) —
    // falls doch, darf share nicht gesetzt sein.
    for (const label of labels) {
      expect(label.share).toBeUndefined();
    }
  });

  it('sollte für ein leeres Model keine Labels liefern', () => {
    const model: CityModel = { districts: [] };
    const layout = buildCityLayout(model, { level: 'city' });

    expect(selectCityLabels(model, layout, 'city')).toEqual([]);
  });
});

describe('resolveLabelCollisions', () => {
  it('sollte alle nicht-überlappenden Kandidaten akzeptieren', () => {
    const candidates = [
      { id: 'a', priority: 3, rect: { x: 0, y: 0, width: 10, height: 10 } },
      { id: 'b', priority: 2, rect: { x: 20, y: 0, width: 10, height: 10 } },
      { id: 'c', priority: 1, rect: { x: 40, y: 0, width: 10, height: 10 } },
    ];

    const visible = resolveLabelCollisions(candidates, 10);

    expect(visible).toEqual(new Set(['a', 'b', 'c']));
  });

  it('sollte bei Überlappung das Label mit niedrigerer Priorität verwerfen', () => {
    const candidates = [
      { id: 'high', priority: 5, rect: { x: 0, y: 0, width: 10, height: 10 } },
      { id: 'low', priority: 1, rect: { x: 5, y: 5, width: 10, height: 10 } }, // überlappt mit 'high'
    ];

    const visible = resolveLabelCollisions(candidates, 10);

    expect(visible).toEqual(new Set(['high']));
  });

  it('sollte maxVisible als harte Obergrenze respektieren, auch ohne Überlappung', () => {
    const candidates = Array.from({ length: 5 }, (_, i) => ({
      id: `label-${i}`,
      priority: 5 - i,
      rect: { x: i * 20, y: 0, width: 10, height: 10 },
    }));

    const visible = resolveLabelCollisions(candidates, 2);

    expect(visible.size).toBe(2);
    expect(visible).toEqual(new Set(['label-0', 'label-1'])); // die zwei höchsten Prioritäten.
  });

  it('sollte bei leerer Kandidatenliste eine leere Menge liefern', () => {
    expect(resolveLabelCollisions([], 10)).toEqual(new Set());
  });
});
