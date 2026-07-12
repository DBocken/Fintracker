/**
 * Kanonische Domänen-Typen der 3D-Finanzstadt (`src/features/finance-city/README.md`,
 * WP-C1). Reine Typdeklarationen ohne Logik — deshalb keine eigene Testdatei
 * (Präzedenzfall: `src/features/dashboard/domain/overview-types.ts`).
 *
 * Diese Typen sind die EINZIGE Quelle für die Stadt-Geometrie-Schicht
 * (`city-layout.ts`, `city-scaling.ts`). `data/city-demo-data.ts` importiert
 * sie (statt eigener lokaler Interfaces) und liefert eine `CityModel`-Fixture;
 * spätere Adapter (`buildSunburstTree`/`computeContracts`) bilden echte Daten
 * auf dieselben Typen ab (README, "Folgeschritte").
 *
 * Beträge (`amount`) sind hier bewusst Anzeige-Euros (Float) aus dem
 * ViewModel, NICHT Integer-Cent (AGENTS.md §8 gilt für Geld-BERECHNUNGEN;
 * hier findet keine Geld-Arithmetik statt, nur Geometrie-Ableitung aus
 * bereits aggregierten Anzeigewerten — einzige Ausnahme ist die
 * Etagen-Stapelung in `city-scaling.ts#scaleFloors`, dort mit exakter
 * Summen-Invariante).
 */

/** Ein laufender Vertrag (z. B. Streaming-Abo) innerhalb einer Unterkategorie. */
export type CityContract = { id: string; label: string; amount: number };

/**
 * Eine Ausgaben-Unterkategorie — ein Gebäude ("Balken") in der Stadt.
 * `contracts` ist nur gesetzt, wenn die Unterkategorie aus mehreren
 * Einzelverträgen besteht (z. B. "Streaming & Abos"); dann kann ihr Balken
 * beim Reinzoomen in Etagen ("floors", eine je Vertrag) aufgelöst werden.
 */
export type CitySubcategory = {
  id: string;
  label: string;
  amount: number;
  contracts?: CityContract[];
};

/** Ein Distrikt (Hauptkategorie-Gruppe) — ein räumlich getrenntes Gebäude-Cluster. */
export type CityDistrict = {
  id: string;
  label: string;
  total: number;
  color: string;
  subcategories: CitySubcategory[];
};

/** Die gesamte Stadt: alle Distrikte. */
export type CityModel = { districts: CityDistrict[] };

/**
 * Einfacher, framework-freier 3D-Vektor. Bewusst KEIN `THREE.Vector3` (domain/
 * darf keine three.js-/React-/Browser-Importe haben, README-Architekturtabelle).
 */
export type Vec3 = { x: number; y: number; z: number };
