/**
 * Auswahl und Inhalt des Vertrags-Sheets (WP-D4/D5, herausgelöst in WP 6.4).
 *
 * Zwei Schritte, beide rein: die drei Navigations-Ids auf die Fachobjekte
 * auflösen (`selectCityContract`) und daraus zusammenstellen, was das Sheet
 * zeigt (`buildCityContractSheet`) — kompakte Buchungsliste, Preis-Trend,
 * Deep-Links. Lag bis WP 6.4 als freie Funktion plus acht lose `const`s in
 * `CityPage.tsx`; der Deep-Link-Aufbau (`?tx=` an einen ggf. leeren
 * Query-String hängen) war dort nur über einen WebGL-Canvas erreichbar.
 */

import { buildTransactionsHref } from '@/features/shared/domain/dashboard-filtering';
import { computeLatestPriceIncrease } from './city-context';
import { OTHER_MERCHANTS_FLOOR_ID } from './city-merchant-floors';
import type { CityBooking, CityContract, CityDistrict, CityModel, CitySubcategory } from './city-model';

/** WP-D4: maximal so viele Buchungen kompakt im Sheet — Tiefe gehört auf die Buchungsseite (CTA darunter). */
export const MAX_SHEET_BOOKINGS = 5;

export type CityContractSelection = {
  district: CityDistrict;
  subcategory: CitySubcategory;
  contract: CityContract;
};

export type CityContractSheet = CityContractSelection & {
  /** Die jüngsten Buchungen, gedeckelt auf `MAX_SHEET_BOOKINGS`. */
  recentBookings: CityBooking[];
  /** Gesamtzahl der Buchungen hinter der Etage — Beschriftung des „alle anzeigen"-Knopfs. */
  totalBookings: number;
  /** WP-D4: Verteuerung gegenüber der vorletzten Buchung, sonst `null`. */
  priceIncrease: number | null;
  /** „Sonstige"-Etage: dort mischen sich Händler, nur dort ist der Zahler je Zeile keine Dopplung. */
  isOtherFloor: boolean;
  /** Deep-Link auf die gefilterte Buchungsseite (Kategorie/Händler laut `contract.filter`). */
  allBookingsHref: string;
  /** Nächste erwartete Zahlung (nur Einnahmen-Welt, regelmäßige Ströme). */
  nextPayment?: { dateISO: string; amount: number };
  /** Deep-Link auf GENAU eine Buchung — derselbe Filter plus `?tx=`. */
  bookingHref(txId: string): string;
};

/**
 * Löst die für das Sheet nötigen Objekte aus den (bereits vom Tap
 * validierten) Ids auf. `null`, sobald eine Id fehlt oder im Modell nicht
 * mehr vorkommt — etwa wenn ein Refetch die Etage entfernt hat, während das
 * Sheet offen stand.
 */
export function selectCityContract(
  model: CityModel,
  districtId: string | null,
  subcategoryId: string | null,
  contractId: string | null,
): CityContractSelection | null {
  if (!districtId || !subcategoryId || !contractId) return null;
  const district = model.districts.find((d) => d.id === districtId);
  const subcategory = district?.subcategories.find((s) => s.id === subcategoryId);
  const contract = subcategory?.contracts?.find((c) => c.id === contractId);
  if (!district || !subcategory || !contract) return null;
  return { district, subcategory, contract };
}

export function buildCityContractSheet(
  selection: CityContractSelection | null | undefined,
  options: { world: 'income' | 'expenses' | 'other'; maxBookings?: number },
): CityContractSheet | null {
  if (!selection) return null;

  const bookings = selection.contract.bookings ?? [];
  // WP-D5: Deep-Link-Semantik kommt aus dem Domain-Modell (`contract.filter`,
  // vom jeweiligen Adapter gesetzt) — die Presentation kennt keine Tab-Sonderfälle.
  const filter = selection.contract.filter;
  const allBookingsHref = buildTransactionsHref({
    category: filter?.categoryId ?? 'all',
    search: filter?.search ?? '',
  });

  return {
    ...selection,
    recentBookings: bookings.slice(0, options.maxBookings ?? MAX_SHEET_BOOKINGS),
    totalBookings: bookings.length,
    // Preis-Trend nur in der Ausgaben-Welt: bei Einnahmen wäre „teurer
    // geworden" eine GUTE Nachricht (Gehaltserhöhung) — der Warnhinweis
    // passt dort nicht.
    priceIncrease: options.world === 'expenses' ? computeLatestPriceIncrease(bookings) : null,
    isOtherFloor: selection.contract.id === OTHER_MERCHANTS_FLOOR_ID,
    allBookingsHref,
    nextPayment: selection.subcategory.nextPayment,
    bookingHref: (txId: string) =>
      `${allBookingsHref}${allBookingsHref.includes('?') ? '&' : '?'}tx=${encodeURIComponent(txId)}`,
  };
}
