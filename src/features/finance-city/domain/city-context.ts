/**
 * Kontext-Zusammenfassung der aktuellen Stadt-Ebene (WP-D3, Nutzer-Wunsch
 * „Kontext-Chip"): WAS betrachte ich gerade, wie groß ist es, und welchen
 * Anteil hat es an der Gesamtausgabe? Reine Funktion ohne React/three.js
 * (README-Architekturtabelle, `domain/`) — die Presentation (`CityPage`)
 * rendert das Ergebnis als dezenten Overlay-Chip auf der Canvas.
 *
 * Geld-Regeln (AGENTS.md §8): Die Gesamtausgabe wird über Integer-Cent
 * summiert (`toMinor`/`sumMinor`), Anteile sind Cent/Cent-Brüche. Alle
 * Einzelbeträge kommen bereits fertig aggregiert aus dem `CityModel`
 * (`district.total`, `subcategory.amount`) — hier findet keine neue
 * Transaktions-Aggregation statt.
 */

import type { CityLevel } from './city-layout';
import type { CityBooking, CityModel } from './city-model';
import { sumMinor, toMinor, toMajor, type Cents } from '@/lib/money';

export type CityContextSummary =
  /** Stadt-Ebene: die Gesamtausgabe aller Distrikte (Bezugsgröße aller %-Werte in den Labels). */
  | { kind: 'city'; amount: number }
  /** Distrikt-Ebene: Name, Distrikt-Total, Anzahl Gebäude (Unterkategorien), Anteil an der Gesamtausgabe. */
  | { kind: 'district'; label: string; amount: number; buildingCount: number; share?: number }
  /** Etagen-/Einzelansicht: Name, Unterkategorie-Betrag, Anzahl Verträge (0 = keine Etagen), Anteil an der Gesamtausgabe. */
  | { kind: 'subcategory'; label: string; amount: number; contractCount: number; share?: number };

function cityTotalMinor(model: CityModel): Cents {
  return sumMinor(model.districts.map((d) => toMinor(d.total)));
}

/**
 * Baut die Kontext-Zusammenfassung für die aktuelle Navigations-Ebene.
 * `null`, wenn die Fokus-Ids nicht auflösbar sind (z. B. Model-Refetch hat
 * einen Distrikt entfernt, während er fokussiert war) — der Chip verschwindet
 * dann einfach, statt falsche Zahlen zu zeigen.
 */
export function selectCityContext(
  model: CityModel,
  level: CityLevel,
  districtId?: string | null,
  subcategoryId?: string | null,
): CityContextSummary | null {
  const totalMinor = cityTotalMinor(model);

  if (level === 'city') {
    return { kind: 'city', amount: toMajor(totalMinor) };
  }

  const district = model.districts.find((d) => d.id === districtId);
  if (!district) return null;

  if (level === 'district') {
    return {
      kind: 'district',
      label: district.label,
      amount: district.total,
      buildingCount: district.subcategories.length,
      share: totalMinor > 0 ? toMinor(district.total) / totalMinor : undefined,
    };
  }

  const subcategory = district.subcategories.find((s) => s.id === subcategoryId);
  if (!subcategory) return null;

  return {
    kind: 'subcategory',
    label: subcategory.label,
    amount: subcategory.amount,
    contractCount: subcategory.contracts?.length ?? 0,
    share: totalMinor > 0 ? toMinor(subcategory.amount) / totalMinor : undefined,
  };
}

/**
 * WP-D4 (Vertrags-Sheet, Preis-Trend bei Abos): Euro-Differenz zwischen der
 * NEUESTEN und der zweitneuesten Buchung einer Etage — nur wenn die neueste
 * TEURER ist (schleichende Preiserhöhung, z. B. Streaming-Abo), sonst `null`
 * (Preissenkungen/gleiche Beträge zeigen keinen Hinweis; ein „billiger
 * geworden"-Hinweis wäre bei schwankenden Händlern wie Supermärkten Rauschen).
 * Vergleich in Integer-Cent (AGENTS.md §8, kein roher Float-Vergleich).
 * Erwartet `bookings` nach Datum absteigend (Modell-Konvention, `CityContract`).
 */
export function computeLatestPriceIncrease(bookings: CityBooking[] | undefined): number | null {
  if (!bookings || bookings.length < 2) return null;
  const diffMinor = (toMinor(bookings[0].amount) - toMinor(bookings[1].amount)) as Cents;
  return diffMinor > 0 ? toMajor(diffMinor) : null;
}
