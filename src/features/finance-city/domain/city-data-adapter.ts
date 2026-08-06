/**
 * Reiner Adapter (WP-C8, `src/features/finance-city/README.md` "Folgeschritte
 * … Echte Daten"): bildet die geteilten Aggregations-Ergebnisse
 * (`buildSunburstTree` aus `src/lib/analysis-data.ts`, Etagen aus
 * `buildMerchantFloorsByBuilding` aus `city-merchant-floors.ts`) auf das
 * kanonische `CityModel` (`city-model.ts`) ab — KEINE eigene Aggregation
 * (AGENTS.md §8): jeder Betrag kommt 1:1 aus dem bereits aggregierten
 * Sunburst-Baum bzw. der bereits aggregierten Etagen-Map. Reine Funktionen,
 * kein React/Query/three.js-Import (README-Architekturtabelle, `domain/`).
 *
 * Mapping-Entscheidungen:
 * - **Distrikt** = jeder Hauptkategorie-Knoten über ALLE Ausgabenklassen
 *   hinweg (`sunburst.children.flatMap(klasse => klasse.children)`), global
 *   nach Betrag absteigend sortiert (nicht nur je Klasse). Farbe kommt aus
 *   einer eigenen, hue-gespreizten Stadt-Palette per Distrikt-Index
 *   (`CITY_DISTRICT_PALETTE`) — NICHT aus `Category.color`, weil die
 *   Default-Taxonomie fast alle Kategorien einheitlich petrol färbt und die
 *   Viertel dadurch ununterscheidbar wären.
 * - **Gebäude** = Unterkategorie-Knoten des Mains. Hat der Main gar keine
 *   Unterkategorien (nur direkt auf der Hauptkategorie gebuchte Ausgaben,
 *   `main.children.length === 0`), synthetisiert der Adapter GENAU EIN
 *   Gebäude für den gesamten Hauptkategorie-Betrag — jeder Distrikt hat so
 *   immer mindestens ein Gebäude. Der von `buildSunburstTree` bereits
 *   synthetisierte „Ohne Unterkategorie"-Knoten (`::__direct`, `categoryId`
 *   = mainId) läuft über denselben Zweig wie echte Unterkategorien mit durch
 *   (kein Sonderfall nötig) — sein Gebäude trägt dadurch dieselbe Id wie der
 *   Distrikt selbst, was mit der Etagen-Zuordnung unten übereinstimmt.
 * - **Etage** = ein Händler innerhalb eines Gebäudes (WP-E2, Nutzer-Befund:
 *   eine einzelne, nicht wiederkehrende Buchung wie Aldi oder eine einmalige
 *   Zeitungs-Buchung tauchte zuvor gar nicht als Etage auf, weil Etagen aus
 *   `computeContracts` kamen und das Händler mit zu wenigen Buchungen
 *   überspringt). `buildMerchantFloorsByBuilding` (`city-merchant-floors.ts`)
 *   liefert bereits eine fertige Gebäude-Id -> Etagen-Map — dieser Adapter
 *   hängt sie nur an die passenden, bereits gebauten Gebäude. Contracts
 *   addieren sich NICHT zur Gebäude-Summe (`amount` bleibt der Sunburst-Wert)
 *   — `city-scaling.ts#scaleFloors` verteilt sie nur proportional auf die
 *   bereits feststehende Balkenhöhe.
 */
import { type SunburstNode, type SunburstTree } from '@/lib/analysis-data';
import type { Category } from '@/types';
import type { CityContract, CityDistrict, CityModel, CitySubcategory } from './city-model';
import { activityLevel } from './city-activity';

/**
 * Distrikt-Farben der Stadt: eine EIGENE, hue-gespreizte Palette statt
 * `Category.color`. Grund: die Default-Taxonomie (`data/merchant-keywords.ts`)
 * färbt nahezu ALLE Hauptkategorien einheitlich petrol (`#2e7d72`) — als
 * Distrikt-Farben wären die Viertel dadurch nicht unterscheidbar
 * (Nutzer-Befund „Farben nicht gut zu erkennen"). Für eine räumliche Karte
 * schlägt Unterscheidbarkeit die Farb-Konsistenz mit den Dashboard-Kategorien.
 * Zuweisung deterministisch per Distrikt-Index (nach Betrag sortiert) — die
 * ersten `length` Distrikte sind damit garantiert farblich verschieden.
 * Töne bewusst mittelhell/mittelgesättigt, damit sie sowohl auf dunklem als
 * auch hellem Hintergrund lesbar bleiben (Light-Mode, WP-C9).
 */
// Nutzer-Befund (WP-D6): die vorherigen mittelgesättigten Töne wirkten auf der
// dunklen Szene ausgewaschen — die Palette ist jetzt bewusst KRÄFTIG
// (hochgesättigte Juwelentöne), zusammen mit dem Emissive-Grundglühen und dem
// ACES-Tone-Mapping der Szene (`city-scene.ts`, Premium-Look) bleiben die
// Viertel auf dunklem UND hellem Hintergrund klar unterscheidbar.
const CITY_DISTRICT_PALETTE = [
  '#14b8a6', // Teal
  '#f0563c', // Koralle
  '#f5a623', // Bernstein
  '#3b82f6', // Blau
  '#a855f7', // Violett
  '#22c55e', // Grün
  '#f97316', // Orange
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#d4a017', // Gold
  '#6366f1', // Indigo
  '#84cc16', // Limette
] as const;

function districtColor(index: number): string {
  return CITY_DISTRICT_PALETTE[index % CITY_DISTRICT_PALETTE.length];
}

/** Ein Gebäude je Unterkategorie-Knoten; ohne jede Unterkategorie GENAU EIN Gebäude für den gesamten Hauptkategorie-Betrag (jeder Distrikt hat so >= 1 Gebäude). */
function buildSubcategoriesForMain(main: SunburstNode): CitySubcategory[] {
  if (main.children.length === 0) {
    // Hauptkategorie-Knoten tragen immer eine categoryId (siehe buildSunburstTree).
    return [{ id: main.categoryId as string, label: main.name, amount: main.value }];
  }
  return main.children.map((sub) => ({
    id: sub.categoryId ?? sub.id,
    label: sub.name,
    amount: sub.value,
  }));
}

/** Führt eingehende Gebäude in `target` zusammen — gleiche Gebäude-Id addiert den Betrag, sonst anhängen. */
function mergeSubcategories(target: CitySubcategory[], incoming: CitySubcategory[]): void {
  for (const sub of incoming) {
    const existing = target.find((s) => s.id === sub.id);
    if (existing) existing.amount += sub.amount;
    else target.push(sub);
  }
}

/**
 * WP-5.4: Länge des Datenfensters in Kalendermonaten — Bezugsgröße der
 * Aktivitäts-FREQUENZ. Bewusst über ALLE Gebäude gebildet und nicht je
 * Gebäude: sonst käme ein Gebäude mit einer einzigen Buchung in einem
 * einzigen Monat auf „1 Buchung / 1 Monat" und damit auf dieselbe Stufe wie
 * ein echtes monatliches Abo.
 */
function dataWindowMonths(floorsByBuilding: Map<string, CityContract[]>): number {
  const months = new Set<string>();
  for (const floors of floorsByBuilding.values()) {
    for (const floor of floors) {
      for (const booking of floor.bookings ?? []) {
        const match = /^(\d{4}-\d{2})/.exec(booking.date);
        if (match) months.add(match[1]);
      }
    }
  }
  return months.size;
}

/** Hängt die vorab aggregierten Händler-Etagen an ihr Gebäude — mutiert die frisch gebauten (noch nicht nach außen sichtbaren) `districts`. */
function attachFloors(districts: CityDistrict[], floorsByBuilding: Map<string, CityContract[]>): void {
  const windowMonths = dataWindowMonths(floorsByBuilding);

  for (const district of districts) {
    for (const building of district.subcategories) {
      const floors = floorsByBuilding.get(building.id);
      if (floors && floors.length > 0) {
        building.contracts = floors;
        // WP-5.1: Wiederkehrender Anteil des Gebäudes = Summe der Etagen, die
        // regelmäßig wiederkommen. Grundlage der Flusslinien. Nur setzen, wenn
        // es tatsächlich etwas gibt — sonst behauptete ein `0` eine geprüfte
        // Aussage, wo gar keine Etagen-Information vorlag.
        const recurringAmount = floors
          .filter((floor) => floor.recurring)
          .reduce((sum, floor) => sum + floor.amount, 0);
        if (recurringAmount > 0) building.recurringAmount = recurringAmount;

        // WP-5.4: Wie oft passiert hier etwas? Zeigt den Unterschied zwischen
        // EINER großen Zahlung und vielen kleinen — den die Gebäudehöhe
        // grundsätzlich nicht zeigen kann.
        const bookingCount = floors.reduce((sum, floor) => sum + (floor.bookings?.length ?? 0), 0);
        building.activity = activityLevel(bookingCount, windowMonths);
      }
    }
  }
}

/**
 * Baut das kanonische `CityModel` aus den geteilten Aggregations-Ergebnissen
 * (siehe Datei-Kommentar für das vollständige Mapping). Leerer Sunburst
 * (keine Ausgaben) -> `{ districts: [] }`.
 */
export function buildCityModelFromData(
  sunburst: SunburstTree,
  // Aktuell ungenutzt: die Etagen-Zuordnung braucht keine Kategorie-Hierarchie
  // mehr (das erledigt bereits `buildMerchantFloorsByBuilding` VOR dem Aufruf
  // hier). Bewusst im Parameter belassen (Unterstrich-Präfix für
  // `noUnusedParameters`), damit die Signatur mit den beiden geteilten
  // Eingaben des Aufrufers (`use-city-model.ts`: Kategorien + Etagen-Map)
  // symmetrisch bleibt und bestehende Aufrufer/Tests nicht auf ein anderes
  // Argument-Layout umgestellt werden müssen.
  _categoriesById: Map<string, Category>,
  floorsByBuilding: Map<string, CityContract[]>,
): CityModel {
  const mainNodes = sunburst.children
    .flatMap((klasse) => klasse.children)
    .filter((main) => main.value > 0);

  // Dieselbe Hauptkategorie kann über MEHRERE Ausgabenklassen-Zweige verteilt
  // sein: `buildSunburstTree` gruppiert primär nach der aus der ZUGEWIESENEN
  // (Unter-)Kategorie aufgelösten Ausgabenklasse, und eine Unterkategorie darf
  // eine ANDERE Klasse haben als ihre Hauptkategorie (Default-Taxonomie, z. B.
  // 'Restaurants' diskretionär unter 'Lebensmittel' essenziell). Bucht ein
  // Nutzer sowohl direkt auf der Hauptkategorie als auch auf einer abweichend
  // klassifizierten Unterkategorie, erscheint dieselbe `categoryId` unter ZWEI
  // Klassen-Knoten. Pro `categoryId` zu EINEM Distrikt zusammenführen (Beträge
  // summieren, Gebäude vereinen) — sonst zwei Kacheln mit identischer id
  // (React-Key-Kollision, per `find`/Map unerreichbare Gebäude, verworfene
  // Vertrags-Etagen). [REGRESSION]
  const order: string[] = [];
  const merged = new Map<string, Omit<CityDistrict, 'color'>>();
  for (const main of mainNodes) {
    const id = main.categoryId as string;
    const subs = buildSubcategoriesForMain(main);
    const existing = merged.get(id);
    if (!existing) {
      order.push(id);
      merged.set(id, { id, label: main.name, total: main.value, subcategories: subs });
    } else {
      existing.total += main.value;
      mergeSubcategories(existing.subcategories, subs);
    }
  }

  // Global nach Betrag absteigend, Farbe deterministisch je Distrikt-Index.
  const districts: CityDistrict[] = order
    .map((id) => merged.get(id) as Omit<CityDistrict, 'color'>)
    .sort((a, b) => b.total - a.total)
    .map((d, index) => ({ ...d, color: districtColor(index) }));

  attachFloors(districts, floorsByBuilding);

  return { districts };
}
