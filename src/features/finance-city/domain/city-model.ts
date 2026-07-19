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

/**
 * Eine einzelne Buchung hinter einer Etage (WP-D4, Vertrags-Sheet als
 * Absprungpunkt): Referenz auf die echte Transaktion (`txId` für den
 * `?tx=`-Deep-Link auf die Buchungsseite) plus Anzeige-Daten. `amount` ist der
 * ABSOLUTE Anzeige-Euro-Betrag (Ausgaben sind im Modell überall positiv).
 */
export type CityBooking = { txId: string; date: string; amount: number; payee: string };

/**
 * Ein laufender Vertrag/Händler (z. B. Streaming-Abo) innerhalb einer
 * Unterkategorie — eine Etage beim Eintauchen. `bookings` (nach Datum
 * absteigend) sind die Einzelbuchungen hinter der Etage, Grundlage der
 * kompakten Buchungsliste im Vertrags-Sheet.
 */
export type CityContract = {
  id: string;
  label: string;
  amount: number;
  bookings?: CityBooking[];
  /**
   * Deep-Link-Semantik dieser Etage für die Buchungsseite (WP-D5): der
   * jeweilige Adapter entscheidet, wie „alle Buchungen dieser Etage" gefiltert
   * werden (Ausgaben: Kategorie + Händler; Einnahmen: ggf. nur Zahler-Suche —
   * Einnahmen-Gebäude-Ids sind KEINE Kategorie-Ids). Die Presentation baut
   * daraus nur noch den Link (`buildTransactionsHref`), ohne Tab-Wissen.
   */
  filter?: { categoryId?: string; search?: string };
};

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
  /** Nächste erwartete Zahlung (nur Einnahmen-Stadt, regelmäßige Ströme) — im Vertrags-Sheet angezeigt. */
  nextPayment?: { dateISO: string; amount: number };
};

/** Ein Distrikt (Hauptkategorie-Gruppe) — ein räumlich getrenntes Gebäude-Cluster. */
export type CityDistrict = {
  id: string;
  label: string;
  total: number;
  color: string;
  subcategories: CitySubcategory[];
  /**
   * SOLL-Wert des Distrikts (WP-D7, Ziele-Tab „Bauprojekt"): Ist er gesetzt,
   * leitet `city-layout.ts` die Hüllen-HÖHE aus diesem Zielwert ab (Hülle =
   * Soll, Balken = Ist — der Füllgrad IST der Fortschritt) statt aus dem
   * höchsten Balken + Kopffreiheit. Gleiche Skala wie `total`/`amount`.
   */
  targetAmount?: number;
  /** WP-D7 (Ziele-Tab): true, wenn das Bauprojekt fertiggestellt (Meilenstein erreicht) ist — Basis für die Chip-Zusammenfassung „X von Y erreicht". */
  achieved?: boolean;
  /**
   * WP-D8 (Übersicht): Platzierungs-Gruppe auf der Platte. Ist sie bei
   * mindestens einem Distrikt gesetzt, layoutet `city-layout.ts` drei
   * Seiten-Bänder (links | mitte | rechts) statt des einen Makro-Grids —
   * Einnahmen-Viertel links, Spar-Turm mittig, Ausgaben-Viertel rechts.
   * Ohne `side` (alle anderen Tabs) unverändert das bisherige Grid.
   */
  side?: 'left' | 'center' | 'right';
};

/**
 * Die gesamte Stadt: alle Distrikte. `valueKind` (WP-D7) sagt der
 * Presentation, WAS die Beträge sind: `'currency'` (Default, Anzeige-Euro,
 * Ausgaben/Einnahmen) oder `'progress'` (Zielfortschritt als Bruch 0..1+,
 * Anzeige in Prozent; Anteils-Prozente an Gesamt/Eltern entfallen).
 */
export type CityModel = {
  districts: CityDistrict[];
  valueKind?: 'currency' | 'progress';
  /**
   * WP-D8 (Übersicht): true unterdrückt die Anteils-Prozente an Gesamt/Eltern
   * in den Labels — die Übersicht mischt Einnahmen-, Ausgaben- und Saldo-
   * Distrikte, eine „Gesamt"-Bezugsgröße darüber wäre irreführend.
   */
  hideShares?: boolean;
};

/**
 * Einfacher, framework-freier 3D-Vektor. Bewusst KEIN `THREE.Vector3` (domain/
 * darf keine three.js-/React-/Browser-Importe haben, README-Architekturtabelle).
 */
export type Vec3 = { x: number; y: number; z: number };
