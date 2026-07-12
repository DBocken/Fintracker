/**
 * Prototyp-Fixture für die 3D-Ausgabenstadt (WP-C0, `src/features/finance-city/README.md`).
 *
 * Diese Datei liefert statische Beispieldaten für den ersten Canvas-Prototyp
 * (WP-C3) — KEINE echte Datenquelle. Kategorie-/Distrikt-/Vertragsnamen sind
 * absichtlich literale deutsche Strings statt i18n-Keys: Präzedenzfall ist
 * `src/services/demo-data-service.ts` (Payee/Beschreibung dort ebenfalls
 * rohe Demo-Strings), weil sie fachliche DEMO-INHALTE sind, nicht App-Chrome
 * (siehe AGENTS.md §6 — i18n gilt für UI-Text, nicht für Fixture-Daten, die
 * spätere echte Nutzerdaten simulieren).
 *
 * `CityDistrictData`/`CitySubcategoryData`/`CityContractData` sind HIER nur
 * vorläufig lokal definiert. WP-C1 zieht sie nach
 * `src/features/finance-city/domain/city-model.ts` um (dann UI-frei per
 * Architektur-Konvention, `docs/architecture/feature-structure.md`) und
 * ersetzt diese Fixture perspektivisch durch einen Adapter, der echte
 * Transaktionsdaten über die bestehenden Domain-Funktionen
 * `buildSunburstTree` (`src/lib/analysis-data.ts`) und `computeContracts`
 * (`src/lib/contract-derivation.ts`) auf dieselben ViewModel-Typen abbildet
 * — kein Duplikat der Aggregationslogik, nur eine neue Projektion darauf.
 *
 * Beträge: Integer-Cent (AGENTS.md §8, `src/lib/money.ts#toMinor`) statt
 * Float-Euro — auch in Fixture-Daten, damit spätere Höhen-/Vergleichslogik
 * (Gebäudehöhe ~ Betrag) nie über Float-Rundungsfehler stolpert.
 */

import { toMinor } from '@/lib/money';
import { CATEGORY_COLORS } from '@/lib/constants';

export type CityDistrictId = 'housing' | 'living' | 'leisure' | 'mobility';

export interface CitySubcategoryData {
  id: string;
  /** Demo-Fixture-Inhalt, siehe Dateikommentar oben — bewusst kein i18n-Key. */
  name: string;
  /** Hex-Farbe aus der bestehenden `CATEGORY_COLORS`-Palette (`@/lib/constants`) statt neuer Werte. */
  color: string;
  /** Integer-Cent (`toMinor`) — Gebäudehöhe im Prototyp ist proportional dazu (WP-C3). */
  monthlyAmountMinor: number;
}

export interface CityDistrictData {
  id: CityDistrictId;
  /** Demo-Fixture-Inhalt, siehe Dateikommentar oben — bewusst kein i18n-Key. */
  name: string;
  /** Basisfarbe des Distrikt-Clusters (Bodenfläche), aus `CATEGORY_COLORS`. */
  color: string;
  subcategories: CitySubcategoryData[];
}

export interface CityContractData {
  id: string;
  /** Demo-Fixture-Inhalt, siehe Dateikommentar oben — bewusst kein i18n-Key. */
  name: string;
  /** Integer-Cent (`toMinor`). */
  monthlyAmountMinor: number;
  color: string;
}

// Fortlaufender Index über alle 16 Unterkategorien: zyklischer Zugriff auf die
// 8-teilige CATEGORY_COLORS-Palette (zwei volle Umläufe) statt neuer Hex-Werte.
// Eine "hübschere" Zuordnung (z. B. Schattierungen je Distrikt) ist bewusst
// WP-C1 überlassen — hier zählt nur: konsistente App-Palette, kein Hardcoding.
let colorIndex = 0;
function nextColor(): string {
  const color = CATEGORY_COLORS[colorIndex % CATEGORY_COLORS.length];
  colorIndex += 1;
  return color;
}

export const CITY_DISTRICTS_DEMO_DATA: CityDistrictData[] = [
  {
    id: 'housing',
    name: 'Wohnen',
    color: CATEGORY_COLORS[0],
    subcategories: [
      { id: 'rent', name: 'Miete', color: nextColor(), monthlyAmountMinor: toMinor(980.0) },
      { id: 'utilities', name: 'Nebenkosten', color: nextColor(), monthlyAmountMinor: toMinor(89.0) },
      { id: 'insurance', name: 'Hausratversicherung', color: nextColor(), monthlyAmountMinor: toMinor(28.5) },
      { id: 'furniture', name: 'Möbel & Hausrat', color: nextColor(), monthlyAmountMinor: toMinor(45.0) },
    ],
  },
  {
    id: 'living',
    name: 'Lebenshaltung',
    color: CATEGORY_COLORS[5],
    subcategories: [
      { id: 'groceries', name: 'Lebensmittel', color: nextColor(), monthlyAmountMinor: toMinor(238.1) },
      { id: 'health', name: 'Gesundheit', color: nextColor(), monthlyAmountMinor: toMinor(16.9) },
      { id: 'personalCare', name: 'Drogerie', color: nextColor(), monthlyAmountMinor: toMinor(24.0) },
      { id: 'household', name: 'Haushaltswaren', color: nextColor(), monthlyAmountMinor: toMinor(30.0) },
    ],
  },
  {
    id: 'leisure',
    name: 'Freizeit',
    color: CATEGORY_COLORS[7],
    subcategories: [
      { id: 'dining', name: 'Restaurant', color: nextColor(), monthlyAmountMinor: toMinor(57.4) },
      { id: 'events', name: 'Kino & Veranstaltungen', color: nextColor(), monthlyAmountMinor: toMinor(25.0) },
      { id: 'hobbies', name: 'Hobbys', color: nextColor(), monthlyAmountMinor: toMinor(40.0) },
      { id: 'shopping', name: 'Shopping', color: nextColor(), monthlyAmountMinor: toMinor(79.99) },
    ],
  },
  {
    id: 'mobility',
    name: 'Mobilität',
    color: CATEGORY_COLORS[4],
    subcategories: [
      { id: 'fuel', name: 'Tanken', color: nextColor(), monthlyAmountMinor: toMinor(132.5) },
      { id: 'publicTransit', name: 'Öffentliche Verkehrsmittel', color: nextColor(), monthlyAmountMinor: toMinor(49.0) },
      { id: 'carInsurance', name: 'Kfz-Versicherung', color: nextColor(), monthlyAmountMinor: toMinor(42.0) },
      { id: 'parking', name: 'Parken', color: nextColor(), monthlyAmountMinor: toMinor(18.0) },
    ],
  },
];

// EXAKT aus der Spec (WP-C0): Netflix 17.99, Spotify 10.99, HBO 9.99, Apple TV 1.00.
export const CITY_STREAMING_CONTRACTS_DEMO_DATA: CityContractData[] = [
  { id: 'netflix', name: 'Netflix', monthlyAmountMinor: toMinor(17.99), color: nextColor() },
  { id: 'spotify', name: 'Spotify', monthlyAmountMinor: toMinor(10.99), color: nextColor() },
  { id: 'hbo', name: 'HBO', monthlyAmountMinor: toMinor(9.99), color: nextColor() },
  { id: 'apple_tv', name: 'Apple TV', monthlyAmountMinor: toMinor(1.0), color: nextColor() },
];
