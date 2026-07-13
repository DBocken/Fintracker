/**
 * Reiner Adapter (WP-C8, `src/features/finance-city/README.md` "Folgeschritte
 * … Echte Daten"): bildet die geteilten Aggregations-Ergebnisse
 * (`buildSunburstTree` aus `src/lib/analysis-data.ts`, `computeContracts` aus
 * `src/lib/contract-derivation.ts`) auf das kanonische `CityModel`
 * (`city-model.ts`) ab — KEINE eigene Aggregation (AGENTS.md §8): jeder Betrag
 * kommt 1:1 aus dem bereits aggregierten Sunburst-Baum bzw. den bereits
 * abgeleiteten Vertragszeilen. Reine Funktionen, kein React/Query/three.js-
 * Import (README-Architekturtabelle, `domain/`).
 *
 * Mapping-Entscheidungen:
 * - **Distrikt** = jeder Hauptkategorie-Knoten über ALLE Ausgabenklassen
 *   hinweg (`sunburst.children.flatMap(klasse => klasse.children)`), global
 *   nach Betrag absteigend sortiert (nicht nur je Klasse). Farbe kommt aus
 *   `Category.color`; fehlt sie, greift eine deterministische Fallback-
 *   Palette (Index im sortierten Distrikt-Array modulo Palettengröße — kein
 *   Zufall, reproduzierbar über Renders/Tests hinweg).
 * - **Gebäude** = Unterkategorie-Knoten des Mains. Hat der Main gar keine
 *   Unterkategorien (nur direkt auf der Hauptkategorie gebuchte Ausgaben,
 *   `main.children.length === 0`), synthetisiert der Adapter GENAU EIN
 *   Gebäude für den gesamten Hauptkategorie-Betrag — jeder Distrikt hat so
 *   immer mindestens ein Gebäude. Der von `buildSunburstTree` bereits
 *   synthetisierte „Ohne Unterkategorie"-Knoten (`::__direct`, `categoryId`
 *   = mainId) läuft über denselben Zweig wie echte Unterkategorien mit durch
 *   (kein Sonderfall nötig) — sein Gebäude trägt dadurch dieselbe Id wie der
 *   Distrikt selbst, was mit der Etagen-Zuordnung unten übereinstimmt.
 * - **Etage** = ein erkannter, laufender wiederkehrender Eintrag (Kandidat
 *   ODER bestätigt/pausiert, mit bekanntem Zyklus, nicht veraltet — siehe
 *   `isFloorContract`), dessen Kategorie über `resolveHierarchy` auf
 *   Distrikt (`mainId`) und Gebäude (`subId ?? mainId` — passt zur
 *   Gebäude-Id-Konvention oben) auflöst. Beträge sind Monatsäquivalente
 *   (`monthlyEquivalent`), bevorzugt aus dem robusteren „letzte 3 Buchungen"-
 *   Median (`amountRecentTypical`), sonst dem Gesamt-Median. Verträge ohne
 *   auflösbares Gebäude (z. B. Kategorie nicht im Sunburst vertreten, etwa
 *   eine als „Einkommen" eingestufte Kategorie) werden übersprungen, nicht
 *   als Absturz behandelt. Contracts addieren sich NICHT zur Gebäude-Summe
 *   (`amount` bleibt der Sunburst-Wert) — `city-scaling.ts#scaleFloors`
 *   verteilt sie nur proportional auf die bereits feststehende Balkenhöhe.
 */
import { resolveHierarchy, type SunburstNode, type SunburstTree } from '@/lib/analysis-data';
import { monthlyEquivalent } from '@/lib/contract-derivation';
import type { ContractRow } from '@/components/contracts/contract-types';
import type { Category } from '@/types';
import { CATEGORY_COLORS } from '@/lib/constants';
import type { CityContract, CityDistrict, CityModel, CitySubcategory } from './city-model';

/**
 * Etage = ein ERKANNTER, laufender wiederkehrender Eintrag innerhalb eines
 * Gebäudes (z. B. Netflix/Spotify unter „Streaming"). Bewusst NICHT
 * `isActiveForTotals` (das verlangt `status === 'active'`, also eine manuelle
 * Vertrags-Bestätigung): frisch kategorisierte Abos sind zunächst `candidate`
 * — würden sie ausgeschlossen, hätte ein Streaming-Gebäude nach dem Zuweisen
 * der Kategorie 0 Etagen ([REGRESSION], Nutzer-Befund „Streaming wird nicht
 * korrekt erkannt"). Aufgenommen werden daher Kandidaten UND aktive/pausierte
 * Verträge mit erkanntem Zyklus, die nicht veraltet sind; ausgeschlossen bleibt
 * nur, was der Nutzer/die Ableitung ausdrücklich verwirft (rejected/ended/
 * archived) oder was gar kein wiederkehrendes Muster ist (`!cycleKnown`) bzw.
 * seit > 2 Zyklen ruht (`stale`, wahrscheinlich beendet).
 */
function isFloorContract(row: ContractRow): boolean {
  if (!row.cycleKnown || row.stale) return false;
  return row.status !== 'rejected' && row.status !== 'ended' && row.status !== 'archived';
}

/** Deterministischer Fallback, falls eine Hauptkategorie keine `color` gesetzt hat — Index im sortierten Distrikt-Array modulo Palettengröße (kein Zufall, reproduzierbar). */
function fallbackColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
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

function buildDistrict(main: SunburstNode, index: number, categoriesById: Map<string, Category>): CityDistrict {
  const id = main.categoryId as string;
  const color = categoriesById.get(id)?.color ?? fallbackColor(index);
  return {
    id,
    label: main.name,
    total: main.value,
    color,
    subcategories: buildSubcategoriesForMain(main),
  };
}

/** Hängt aktive Vertrags-Etagen an ihr aufgelöstes Gebäude — mutiert die frisch gebauten (noch nicht nach außen sichtbaren) `districts`. */
function attachContracts(
  districts: CityDistrict[],
  expenseContracts: ContractRow[],
  categoriesById: Map<string, Category>,
): void {
  const districtById = new Map(districts.map((d) => [d.id, d]));

  for (const row of expenseContracts) {
    if (!isFloorContract(row) || row.categoryId == null) continue;

    const { mainId, subId } = resolveHierarchy(categoriesById, row.categoryId);
    const district = districtById.get(mainId);
    if (!district) continue; // Kategorie nicht im Sunburst vertreten (z. B. Einkommens-Klasse) — überspringen statt crashen.

    const buildingId = subId ?? mainId;
    const building = district.subcategories.find((s) => s.id === buildingId);
    if (!building) continue;

    const amount = monthlyEquivalent(row.amountRecentTypical ?? row.amountTypical, row.cycle);
    if (!(amount > 0)) continue;

    const contract: CityContract = { id: row.key, label: row.payee, amount };
    if (!building.contracts) building.contracts = [];
    building.contracts.push(contract);
  }
}

/**
 * Baut das kanonische `CityModel` aus den geteilten Aggregations-Ergebnissen
 * (siehe Datei-Kommentar für das vollständige Mapping). Leerer Sunburst
 * (keine Ausgaben) -> `{ districts: [] }`.
 */
export function buildCityModelFromData(
  sunburst: SunburstTree,
  categoriesById: Map<string, Category>,
  expenseContracts: ContractRow[],
): CityModel {
  const mainNodes = sunburst.children
    .flatMap((klasse) => klasse.children)
    .filter((main) => main.value > 0)
    .sort((a, b) => b.value - a.value);

  const districts = mainNodes.map((main, index) => buildDistrict(main, index, categoriesById));
  attachContracts(districts, expenseContracts, categoriesById);

  return { districts };
}
