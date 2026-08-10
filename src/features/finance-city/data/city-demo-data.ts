/**
 * Fixture für die 3D-Ausgabenstadt (`src/features/finance-city/README.md`).
 *
 * Diese Datei liefert statische Beispieldaten für den Canvas-Prototyp
 * (WP-C3) — KEINE echte Datenquelle. Kategorie-/Distrikt-/Vertragsnamen sind
 * absichtlich literale deutsche Strings statt i18n-Keys: Präzedenzfall ist
 * `src/services/demo-data-service.ts` (Payee/Beschreibung dort ebenfalls
 * rohe Demo-Strings), weil sie fachliche DEMO-INHALTE sind, nicht App-Chrome
 * (siehe AGENTS.md §6 — i18n gilt für UI-Text, nicht für Fixture-Daten, die
 * spätere echte Nutzerdaten simulieren).
 *
 * WP-C1: Die vormals hier lokal definierten `CityDistrictData`/
 * `CitySubcategoryData`/`CityContractData`-Interfaces sind nach
 * `src/features/finance-city/domain/city-model.ts` umgezogen (kanonische,
 * UI-freie Domain-Typen) und werden hier nur noch importiert. Diese Datei
 * exportiert direkt ein `CityModel` (`cityDemoModel`) statt der alten
 * Zwischenrepräsentation. Spätere Adapter ersetzen diese Fixture perspek-
 * tivisch durch eine Projektion echter Transaktionsdaten über die
 * bestehenden Domain-Funktionen `buildSunburstTree`
 * (`src/lib/analysis-data.ts`) und `computeContracts`
 * (`src/lib/contract-derivation.ts`) auf denselben `CityModel`-Typ — kein
 * Duplikat der Aggregationslogik, nur eine neue Projektion darauf.
 *
 * Beträge: intern über Integer-Cent (AGENTS.md §8, `src/lib/money.ts#toMinor`)
 * berechnet, damit Rundung deterministisch bleibt — `CityModel#amount` ist
 * aber bewusst Anzeige-Euro (Float), siehe `domain/city-model.ts`
 * (die Domain-Schicht rechnet nicht mit Geld, nur mit bereits aggregierten
 * Anzeigewerten).
 */

import { toMinor, toMajor, sumMinor } from '@/lib/money';
import { CATEGORY_COLORS } from '@/lib/constants';
import type { CityContract, CityDistrict, CityModel, CitySubcategory } from '../domain/city-model';

/** Euro-Eingabe -> exakter Anzeige-Euro-Wert, über Integer-Cent gerundet (AGENTS.md §8). */
function euro(amount: number): number {
  return toMajor(toMinor(amount));
}

function sumEuro(amounts: number[]): number {
  return toMajor(sumMinor(amounts.map(toMinor)));
}

// EXAKT aus der Spec (WP-C0): Netflix 17.99, Spotify 10.99, HBO 9.99, Apple TV 1.00.
const STREAMING_CONTRACTS: CityContract[] = [
  { id: 'netflix', label: 'Netflix', amount: euro(17.99) },
  { id: 'spotify', label: 'Spotify', amount: euro(10.99) },
  { id: 'hbo', label: 'HBO', amount: euro(9.99) },
  { id: 'apple_tv', label: 'Apple TV', amount: euro(1.0) },
];

function district(id: string, label: string, color: string, subcategories: CitySubcategory[]): CityDistrict {
  return { id, label, color, total: sumEuro(subcategories.map((s) => s.amount)), subcategories };
}

export const cityDemoModel: CityModel = {
  districts: [
    district('housing', 'Wohnen', CATEGORY_COLORS[0], [
      { id: 'rent', label: 'Miete', amount: euro(980.0) },
      { id: 'utilities', label: 'Nebenkosten', amount: euro(89.0) },
      { id: 'insurance', label: 'Hausratversicherung', amount: euro(28.5) },
      { id: 'furniture', label: 'Möbel & Hausrat', amount: euro(45.0) },
    ]),
    district('living', 'Lebenshaltung', CATEGORY_COLORS[5], [
      { id: 'groceries', label: 'Lebensmittel', amount: euro(238.1) },
      { id: 'health', label: 'Gesundheit', amount: euro(16.9) },
      { id: 'personalCare', label: 'Drogerie', amount: euro(24.0) },
      { id: 'household', label: 'Haushaltswaren', amount: euro(30.0) },
    ]),
    // "Streaming" bündelt die laufenden Streaming-Verträge als eigene
    // Unterkategorie (contracts-Feld) innerhalb von Freizeit — passend zur
    // README-Beschreibung ("Ausgaben-Unterkategorien UND laufende Verträge").
    district('leisure', 'Freizeit', CATEGORY_COLORS[7], [
      { id: 'dining', label: 'Restaurant', amount: euro(57.4) },
      { id: 'events', label: 'Kino & Veranstaltungen', amount: euro(25.0) },
      { id: 'hobbies', label: 'Hobbys', amount: euro(40.0) },
      { id: 'shopping', label: 'Shopping', amount: euro(79.99) },
      {
        id: 'streaming',
        label: 'Streaming',
        amount: sumEuro(STREAMING_CONTRACTS.map((c) => c.amount)),
        contracts: STREAMING_CONTRACTS,
      },
    ]),
    district('mobility', 'Mobilität', CATEGORY_COLORS[4], [
      { id: 'fuel', label: 'Tanken', amount: euro(132.5) },
      { id: 'publicTransit', label: 'Öffentliche Verkehrsmittel', amount: euro(49.0) },
      { id: 'carInsurance', label: 'Kfz-Versicherung', amount: euro(42.0) },
      { id: 'parking', label: 'Parken', amount: euro(18.0) },
    ]),
  ],
};
