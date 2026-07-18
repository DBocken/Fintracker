import { describe, it, expect } from 'vitest';
import { selectCityContext } from '../city-context';
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
            ],
          },
        ],
      },
    ],
  };
}

describe('selectCityContext', () => {
  it('sollte auf Stadt-Ebene die Gesamtausgabe (Summe aller Distrikt-Totale, Cent-genau) liefern', () => {
    const context = selectCityContext(makeModel(), 'city');
    expect(context).toEqual({ kind: 'city', amount: 1148.97 }); // 1069,00 + 79,97
  });

  it('sollte auf Distrikt-Ebene Name, Total, Gebäudezahl und Anteil an der Gesamtausgabe liefern', () => {
    const context = selectCityContext(makeModel(), 'district', 'leisure');
    expect(context).toMatchObject({
      kind: 'district',
      label: 'Freizeit',
      amount: 79.97,
      buildingCount: 2,
    });
    if (context?.kind !== 'district') throw new Error('unerwarteter kind');
    expect(context.share).toBeCloseTo(7997 / 114897, 10);
  });

  it('sollte auf Unterkategorie-Ebene Name, Betrag, Vertragszahl und Anteil liefern', () => {
    const context = selectCityContext(makeModel(), 'subcategory', 'leisure', 'streaming');
    expect(context).toMatchObject({
      kind: 'subcategory',
      label: 'Streaming & Abos',
      amount: 39.97,
      contractCount: 2,
    });
    if (context?.kind !== 'subcategory') throw new Error('unerwarteter kind');
    expect(context.share).toBeCloseTo(3997 / 114897, 10);
  });

  it('sollte für eine Unterkategorie OHNE Verträge contractCount 0 liefern', () => {
    const context = selectCityContext(makeModel(), 'subcategory', 'leisure', 'hobbies');
    expect(context).toMatchObject({ kind: 'subcategory', contractCount: 0 });
  });

  it('sollte null liefern, wenn die Fokus-Ids nicht auflösbar sind (kein falscher Chip)', () => {
    expect(selectCityContext(makeModel(), 'district', 'unbekannt')).toBeNull();
    expect(selectCityContext(makeModel(), 'subcategory', 'leisure', 'unbekannt')).toBeNull();
    expect(selectCityContext(makeModel(), 'subcategory', undefined, 'streaming')).toBeNull();
  });

  it('sollte bei Gesamtausgabe 0 keinen Anteil liefern (kein Division-durch-0)', () => {
    const model: CityModel = {
      districts: [{ id: 'x', label: 'X', color: '#000000', total: 0, subcategories: [{ id: 'y', label: 'Y', amount: 0 }] }],
    };
    const context = selectCityContext(model, 'district', 'x');
    expect(context).toMatchObject({ kind: 'district', amount: 0 });
    if (context?.kind !== 'district') throw new Error('unerwarteter kind');
    expect(context.share).toBeUndefined();
  });
});
