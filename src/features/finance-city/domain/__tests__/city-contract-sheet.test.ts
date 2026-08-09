/**
 * WP 6.4 (ARCH-5/KOMP-1): Auswahl-Aufloesung (Ids → Fachobjekte) und die
 * Sheet-Ableitung darauf. Beides lag als freie Funktion bzw. als lose Kette
 * von `const`s in `CityPage.tsx` und war damit nur mit Canvas testbar.
 */
import { describe, it, expect } from 'vitest';
import { selectCityContract, buildCityContractSheet } from '../city-contract-sheet';
import { OTHER_MERCHANTS_FLOOR_ID } from '../city-merchant-floors';
import type { CityModel } from '../city-model';

const MODEL: CityModel = {
  districts: [
    {
      id: 'leisure',
      label: 'Freizeit',
      color: '#111111',
      total: 60,
      subcategories: [
        {
          id: 'streaming',
          label: 'Streaming',
          amount: 60,
          nextPayment: { dateISO: '2026-09-01', amount: 12 },
          contracts: [
            {
              id: 'netflix',
              label: 'Netflix',
              amount: 20,
              filter: { categoryId: 'cat-leisure', search: 'Netflix' },
              bookings: [
                { txId: 't1', date: '2026-08-01', amount: 20, payee: 'Netflix' },
                { txId: 't2', date: '2026-07-01', amount: 15, payee: 'Netflix' },
                { txId: 't3', date: '2026-06-01', amount: 15, payee: 'Netflix' },
                { txId: 't4', date: '2026-05-01', amount: 15, payee: 'Netflix' },
                { txId: 't5', date: '2026-04-01', amount: 15, payee: 'Netflix' },
                { txId: 't6', date: '2026-03-01', amount: 15, payee: 'Netflix' },
              ],
            },
            { id: OTHER_MERCHANTS_FLOOR_ID, label: 'Sonstige', amount: 40, bookings: [] },
          ],
        },
      ],
    },
  ],
};

describe('selectCityContract', () => {
  it('sollte Distrikt, Unterkategorie und Vertrag zu den drei Ids aufloesen', () => {
    const selection = selectCityContract(MODEL, 'leisure', 'streaming', 'netflix');

    expect(selection?.district.id).toBe('leisure');
    expect(selection?.subcategory.id).toBe('streaming');
    expect(selection?.contract.id).toBe('netflix');
  });

  it('sollte null liefern, sobald eine der drei Ids fehlt', () => {
    expect(selectCityContract(MODEL, null, 'streaming', 'netflix')).toBeNull();
    expect(selectCityContract(MODEL, 'leisure', null, 'netflix')).toBeNull();
    expect(selectCityContract(MODEL, 'leisure', 'streaming', null)).toBeNull();
  });

  it('sollte null liefern, wenn eine Id im Modell nicht (mehr) vorkommt — Refetch waehrend geoeffnetem Sheet', () => {
    expect(selectCityContract(MODEL, 'leisure', 'streaming', 'weg')).toBeNull();
    expect(selectCityContract(MODEL, 'weg', 'streaming', 'netflix')).toBeNull();
  });
});

describe('buildCityContractSheet', () => {
  const selection = selectCityContract(MODEL, 'leisure', 'streaming', 'netflix');

  it('sollte hoechstens fuenf Buchungen kompakt zeigen und die Gesamtzahl behalten', () => {
    const sheet = buildCityContractSheet(selection, { world: 'expenses' });

    expect(sheet?.recentBookings).toHaveLength(5);
    expect(sheet?.totalBookings).toBe(6);
  });

  it('sollte die Preiserhoehung nur in der Ausgaben-Welt melden', () => {
    expect(buildCityContractSheet(selection, { world: 'expenses' })?.priceIncrease).toBe(5);
    expect(buildCityContractSheet(selection, { world: 'income' })?.priceIncrease).toBeNull();
  });

  it('sollte den Deep-Link aus dem Filter des Vertrags bauen (Kategorie + Haendlersuche)', () => {
    const sheet = buildCityContractSheet(selection, { world: 'expenses' });

    expect(sheet?.allBookingsHref).toContain('cat=cat-leisure');
    expect(sheet?.allBookingsHref).toContain('q=Netflix');
  });

  it('sollte je Buchung einen tx-Deep-Link an den gefilterten Link haengen', () => {
    const sheet = buildCityContractSheet(selection, { world: 'expenses' });

    expect(sheet?.bookingHref('t1')).toBe(`${sheet?.allBookingsHref}&tx=t1`);
  });

  it('sollte den tx-Parameter auch ohne Query-String korrekt anfuegen', () => {
    const ohneFilter = selectCityContract(MODEL, 'leisure', 'streaming', OTHER_MERCHANTS_FLOOR_ID);
    const sheet = buildCityContractSheet(ohneFilter, { world: 'expenses' });

    expect(sheet?.allBookingsHref).toBe('/transactions');
    expect(sheet?.bookingHref('t9')).toBe('/transactions?tx=t9');
  });

  it('sollte die Sonstige-Etage kennzeichnen (dort ist der Zahler nicht redundant)', () => {
    expect(buildCityContractSheet(selection, { world: 'expenses' })?.isOtherFloor).toBe(false);
    const sonstige = selectCityContract(MODEL, 'leisure', 'streaming', OTHER_MERCHANTS_FLOOR_ID);
    expect(buildCityContractSheet(sonstige, { world: 'expenses' })?.isOtherFloor).toBe(true);
  });

  it('sollte die naechste erwartete Zahlung der Unterkategorie durchreichen', () => {
    expect(buildCityContractSheet(selection, { world: 'expenses' })?.nextPayment).toEqual({
      dateISO: '2026-09-01',
      amount: 12,
    });
  });

  it('sollte null liefern, wenn nichts ausgewaehlt ist', () => {
    expect(buildCityContractSheet(null, { world: 'expenses' })).toBeNull();
  });

  it('sollte ein ausdrueckliches undefined als „keine Auswahl" behandeln', () => {
    expect(buildCityContractSheet(undefined, { world: 'expenses' })).toBeNull();
  });
});
