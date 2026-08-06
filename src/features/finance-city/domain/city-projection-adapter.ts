/**
 * WP-5.2 — Zukunftsmonat der Finanzstadt.
 *
 * Bildet die Prognose des bestehenden Forecasts
 * (`@/lib/forecast-category-projection#projectCategorySpend`) auf dasselbe
 * `CityModel` ab, das auch die Ist-Monate benutzen. Damit ist ein
 * Zukunftsmonat dieselbe Stadt in derselben Geometrie — nur mit anderen Höhen.
 *
 * Hier wird NICHTS prognostiziert. Der Adapter bekommt fertige Beträge je
 * Kategorie-ID und ordnet sie der Hierarchie zu (`resolveHierarchy`, dieselbe
 * Funktion wie `city-merchant-floors.ts`). Eine zweite Prognose neben dem
 * Cashflow-Forecast, die diesem widersprechen kann, ist genau das, was
 * vermieden werden soll.
 *
 * Was ein Zukunftsmonat NICHT hat, und warum:
 * - **keine Etagen.** Die Prognose kennt Kategorien, keine Händler. Etagen zu
 *   erfinden hieße, Zahlen auf eine Genauigkeit zu bringen, die es nicht gibt.
 * - **keine Aktivität** (WP-5.4). Die Fassaden-Fenster zählen Buchungen —
 *   eine prognostizierte Buchungsfrequenz wäre geraten.
 * - **keine Flusslinien** (WP-5.1). Wiederkehr wird aus Buchungsdaten
 *   abgeleitet; im Zukunftsmonat gibt es keine.
 *
 * Rein und browserfrei (README-Architekturtabelle, `domain/`).
 */

import { resolveHierarchy } from '@/lib/analysis-data';
import type { Category } from '@/types';
import type { CityDistrict, CityModel, CitySubcategory } from './city-model';

export type BuildProjectionModelOptions = {
  /**
   * Feste Farbe je Distrikt-ID (aus `districtColorMap` des Ist-Modells). Ohne
   * sie fiele die Zukunft farblich aus der Reihe — die Stadt soll beim
   * Monatswechsel erkennbar dieselbe bleiben.
   */
  colorByDistrictId?: ReadonlyMap<string, string>;
  /** Ersatzfarbe für Distrikte, die es im Ist-Modell (noch) nicht gibt. */
  fallbackColor?: string;
};

const FALLBACK_DISTRICT_COLOR = '#64748b';

/**
 * Baut das Stadt-Modell eines Prognosemonats aus `categoryId -> erwarteter
 * Betrag`.
 *
 * Gebäude-Id ist — wie im Ist-Adapter — `subId ?? mainId`; der Distrikt ist die
 * Hauptkategorie. Kategorien, die sich nicht auflösen lassen (gelöscht,
 * unbekannt), werden übersprungen statt unter einer erfundenen Id einzugehen.
 */
export function buildCityModelFromProjection(
  projection: ReadonlyMap<string, number>,
  categoriesById: Map<string, Category>,
  options: BuildProjectionModelOptions = {},
): CityModel {
  const byDistrict = new Map<string, { label: string; buildings: Map<string, CitySubcategory> }>();

  for (const [categoryId, amount] of projection) {
    if (!(amount > 0)) continue;
    const category = categoriesById.get(categoryId);
    if (!category) continue; // Nicht auflösbar -> überspringen statt zu erfinden.

    const { mainId, subId } = resolveHierarchy(categoriesById, categoryId);
    const main = categoriesById.get(mainId);
    if (!main) continue;

    const buildingId = subId ?? mainId;
    let district = byDistrict.get(mainId);
    if (!district) {
      district = { label: main.name, buildings: new Map() };
      byDistrict.set(mainId, district);
    }

    const existing = district.buildings.get(buildingId);
    if (existing) existing.amount += amount;
    else {
      district.buildings.set(buildingId, {
        id: buildingId,
        label: categoriesById.get(buildingId)?.name ?? category.name,
        amount,
      });
    }
  }

  const districts: CityDistrict[] = [...byDistrict.entries()]
    .map(([id, district]) => ({
      id,
      label: district.label,
      total: [...district.buildings.values()].reduce((sum, building) => sum + building.amount, 0),
      subcategories: [...district.buildings.values()].sort((a, b) => b.amount - a.amount),
      color: options.colorByDistrictId?.get(id) ?? options.fallbackColor ?? FALLBACK_DISTRICT_COLOR,
    }))
    .sort((a, b) => b.total - a.total);

  // `projected` markiert das GANZE Modell, nicht einzelne Gebäude: in einem
  // Prognosemonat ist jede Zahl eine Prognose. Eine Mischung aus Ist und
  // Prognose in einer Ansicht wäre nicht erklärbar — deshalb trennt die
  // Zeitachse die Monate sauber (siehe `city-timeline.ts`).
  return { districts, projected: true };
}
