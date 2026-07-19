import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildCityModelFromIncomeStreams, EARLIER_MONTHS_FLOOR_ID } from '../city-income-adapter';
import type { IncomeStream, IncomeStreamsResult } from '@/lib/income-streams';

// "Frühere Monate"-Label kommt aus serviceT (liest die Sprache aus localStorage,
// Präzedenzfall city-merchant-floors.test.ts).
beforeEach(() => {
  window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
});
afterEach(() => {
  window.localStorage.removeItem('ausgabentracker_locale_v1');
});

function stream(overrides: Partial<IncomeStream> & { key: string; label: string; totalInWindow: number }): IncomeStream {
  return {
    counterparty: overrides.label.toLowerCase(),
    mainCategoryId: 'cat-income',
    mainCategoryName: 'Gehalt',
    isSalary: false,
    cadence: 'regelmaessig',
    monthlyAverage: 0,
    lastDateISO: '2026-06-28',
    lastAmount: 0,
    monthsActive: 1,
    trend: 'flat',
    confidence: 1,
    share: 0,
    transactionCount: 1,
    nextDateISO: null,
    nextAmount: null,
    monthlyTotals: {},
    payments: [],
    ...overrides,
  };
}

function result(streams: IncomeStream[]): IncomeStreamsResult {
  return { streams, totalIncome: 0, largestShare: 0, diversification: 'diversified', windowMonths: 12 };
}

describe('buildCityModelFromIncomeStreams', () => {
  it('sollte Ströme nach Einnahmen-Hauptkategorie zu Distrikten gruppieren, nach Gesamtbetrag absteigend mit eigener Farb-Palette', () => {
    const model = buildCityModelFromIncomeStreams(
      result([
        stream({ key: 'a', label: 'Arbeitgeber', totalInWindow: 3000, mainCategoryId: 'cat-gehalt', mainCategoryName: 'Gehalt' }),
        stream({ key: 'b', label: 'Broker', totalInWindow: 120, mainCategoryId: 'cat-kapital', mainCategoryName: 'Kapitalerträge' }),
        stream({ key: 'c', label: 'Nebenjob', totalInWindow: 400, mainCategoryId: 'cat-gehalt', mainCategoryName: 'Gehalt' }),
      ]),
    );

    expect(model.districts).toHaveLength(2);
    // Gehalt (3400) vor Kapitalerträge (120), Cent-genau summiert.
    expect(model.districts[0]).toMatchObject({ label: 'Gehalt', total: 3400 });
    expect(model.districts[1]).toMatchObject({ label: 'Kapitalerträge', total: 120 });
    // Jeder Strom ein Gebäude im richtigen Distrikt.
    expect(model.districts[0].subcategories.map((s) => s.label).sort()).toEqual(['Arbeitgeber', 'Nebenjob']);
    // Farben: gültige Hex-Werte, je Distrikt verschieden (Grün-Palette).
    for (const district of model.districts) {
      expect(district.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(model.districts[0].color).not.toBe(model.districts[1].color);
  });

  it('sollte je Strom eine Etage pro Monat bauen (neueste zuerst) — Betrag = Monatssumme, bookings = Einzelzahlungen des Monats', () => {
    const model = buildCityModelFromIncomeStreams(
      result([
        stream({
          key: 's',
          label: 'Arbeitgeber',
          totalInWindow: 6050,
          payments: [
            { txId: 'p3', dateISO: '2026-06-28', amount: 3000, payee: 'Arbeitgeber' },
            { txId: 'p2', dateISO: '2026-05-28', amount: 3000, payee: 'Arbeitgeber' },
            { txId: 'p1', dateISO: '2026-05-02', amount: 50, payee: 'Arbeitgeber' },
          ],
        }),
      ]),
    );

    const building = model.districts[0].subcategories[0];
    expect(building.contracts).toHaveLength(2);
    expect(building.contracts![0]).toMatchObject({ label: '06/2026', amount: 3000 });
    // Mai bündelt beide Zahlungen (3000 + 50), Cent-genau.
    expect(building.contracts![1]).toMatchObject({ label: '05/2026', amount: 3050 });
    expect(building.contracts![1].bookings!.map((b) => b.txId)).toEqual(['p2', 'p1']);
  });

  it('sollte bei mehr als 5 Monaten die neuesten 5 als eigene Etagen behalten und ältere zu "Frühere Monate" bündeln', () => {
    const payments = Array.from({ length: 7 }, (_, i) => ({
      txId: `p${i}`,
      dateISO: `2026-0${7 - i}-15`, // 07, 06, ..., 01
      amount: 100,
      payee: 'Arbeitgeber',
    }));
    const model = buildCityModelFromIncomeStreams(
      result([stream({ key: 's', label: 'Arbeitgeber', totalInWindow: 700, payments })]),
    );

    const floors = model.districts[0].subcategories[0].contracts!;
    expect(floors).toHaveLength(6);
    expect(floors[0].label).toBe('07/2026');
    expect(floors[4].label).toBe('03/2026');
    const earlier = floors[5];
    expect(earlier.id.endsWith(EARLIER_MONTHS_FLOOR_ID)).toBe(true);
    expect(earlier.label).toBe('Frühere Monate');
    expect(earlier.amount).toBeCloseTo(200, 10); // 02 + 01
    expect(earlier.bookings).toHaveLength(2);
  });

  it('sollte den Etagen-Deep-Link mit Zahler-Suche setzen — Kategorie nur bei ECHTER Kategorie-Id (nicht synthetisch "__uncategorized")', () => {
    const model = buildCityModelFromIncomeStreams(
      result([
        stream({
          key: 'real',
          label: 'Arbeitgeber',
          totalInWindow: 3000,
          mainCategoryId: 'cat-gehalt',
          payments: [{ txId: 'p1', dateISO: '2026-06-28', amount: 3000, payee: 'Arbeitgeber' }],
        }),
        stream({
          key: 'synthetic',
          label: 'Unbekannt GmbH',
          totalInWindow: 100,
          mainCategoryId: '__uncategorized_main',
          mainCategoryName: 'Unkategorisiert',
          payments: [{ txId: 'p2', dateISO: '2026-06-10', amount: 100, payee: 'Unbekannt GmbH' }],
        }),
      ]),
    );

    const realFloor = model.districts.find((d) => d.label === 'Gehalt')!.subcategories[0].contracts![0];
    expect(realFloor.filter).toEqual({ categoryId: 'cat-gehalt', search: 'Arbeitgeber' });

    const syntheticFloor = model.districts.find((d) => d.label === 'Unkategorisiert')!.subcategories[0].contracts![0];
    expect(syntheticFloor.filter).toEqual({ search: 'Unbekannt GmbH' }); // keine Kategorie, die nichts matchen würde.
  });

  it('sollte die nächste erwartete Zahlung regelmäßiger Ströme ans Gebäude heften (fürs Vertrags-Sheet)', () => {
    const model = buildCityModelFromIncomeStreams(
      result([
        stream({ key: 'a', label: 'Arbeitgeber', totalInWindow: 3000, nextDateISO: '2026-07-28', nextAmount: 3000 }),
        stream({ key: 'b', label: 'Flohmarkt', totalInWindow: 80, cadence: 'unregelmaessig' }),
      ]),
    );

    const buildings = model.districts[0].subcategories;
    expect(buildings.find((b) => b.label === 'Arbeitgeber')!.nextPayment).toEqual({ dateISO: '2026-07-28', amount: 3000 });
    expect(buildings.find((b) => b.label === 'Flohmarkt')!.nextPayment).toBeUndefined();
  });

  it('sollte ohne Ströme ein leeres Modell liefern (Empty-State der Page)', () => {
    expect(buildCityModelFromIncomeStreams(result([]))).toEqual({ districts: [] });
  });
});
