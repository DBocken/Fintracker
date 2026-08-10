import type { Ausgabenklasse, Category, Transaction, TransactionAllocation } from "@/types";
import { t as translate } from "@/i18n/serviceT";
import { toMinor, toMajor, sumMinor, type Cents } from "@/lib/money";

/**
 * Schmaler Kern der Auswertung: transferbereinigte Summen, Kategorie-Beiträge
 * einer Buchung und die Hierarchie-Auflösung, auf der beides aufsetzt.
 *
 * Der Diagramm-Aufbau (Sankey, Sunburst, Einnahmen-Aufschlüsselung,
 * Wochenmuster) lag bis WP 6.6 ebenfalls hier und liegt seither in
 * `src/lib/chart-data/` (ARCH-6). AGENTS.md §8 bleibt davon unberührt:
 * Aggregation läuft weiterhin ausschließlich über `sumIncome`/`sumExpenses`
 * aus diesem Modul.
 */

/**
 * Transferbereinigte Einnahmen-/Ausgabensummen — eine Quelle der Wahrheit für
 * Dashboard, Premium-Dashboard und Export. Interne Überträge zwischen eigenen
 * Konten (`is_transfer`) zählen weder als Einnahme noch als Ausgabe
 * (Domänen-Invariante 2). Ersetzt komponenten-lokale reduce-Ketten, die
 * Transfers fälschlich mitzählten (F-MONEY-3).
 */
export function sumIncome(transactions: Transaction[]): number {
  return transactions
    .filter((t) => !t.is_transfer && t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
}

/** Betrag (positiv) der transferbereinigten Ausgaben. Siehe `sumIncome`. */
export function sumExpenses(transactions: Transaction[]): number {
  return Math.abs(
    transactions
      .filter((t) => !t.is_transfer && t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0),
  );
}

/** Ein Kategorie-Beitrag einer Transaktion (eigene Kategorie oder eine Aufteilung). */
export interface CategoryContribution {
  /** subcategory_id ?? category_id der Aufteilung bzw. der Transaktion. */
  assignedId: string | null;
  /** Signierter Euro-Betrag (gleiches Vorzeichen wie die Transaktion). */
  amount: number;
}

/**
 * Expandiert eine Transaktion in ihre Kategorie-Beiträge: nutzt Aufteilungen,
 * falls vorhanden, sonst die eigene Kategorie der Transaktion. Die Summe der
 * Beiträge entspricht dem Transaktionsbetrag (Invariante vom Allocation-Service
 * garantiert). Ohne Map verhält sich alles wie zuvor (eine Kategorie je Buchung).
 */
export function getCategoryContributions(
  t: Transaction,
  allocationsByTx?: Map<string, TransactionAllocation[]>,
): CategoryContribution[] {
  const allocs = t.id ? allocationsByTx?.get(t.id) : undefined;
  if (allocs && allocs.length > 0) {
    return allocs.map((a) => ({
      assignedId: a.subcategory_id ?? a.category_id ?? null,
      amount: a.amount_minor / 100,
    }));
  }
  return [{ assignedId: t.subcategory_id ?? t.category_id ?? null, amount: t.amount }];
}

/**
 * Hierarchie-bewusster Kategorie-Vergleich: liegt `categoryId` in der
 * gewählten Kategorie — direkt oder als Nachfahre? Damit erfasst die Auswahl
 * einer Hauptkategorie auch deren Unterkategorien. Die direkt zugewiesene ID
 * zählt auch dann, wenn die Kategorie nicht (mehr) existiert.
 *
 * Wohnt hier statt bei den Dashboard-Filtern, weil auch reine Domain-/
 * Auswertungsschichten (Kennzahlen der Buchungsseite) sie brauchen und nicht
 * aus `src/components/` importieren dürfen (AGENTS.md §3).
 */
export function isCategoryInFilter(
  categoryId: string | null | undefined,
  categoriesById: Map<string, Category>,
  filter: string,
): boolean {
  if (!categoryId) return false;
  if (categoryId === filter) return true;
  let current: Category | undefined = categoriesById.get(categoryId);
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    if (current.id === filter) return true;
    visited.add(current.id);
    current = current.parent_id ? categoriesById.get(current.parent_id) : undefined;
  }
  return false;
}

/**
 * Transferbereinigte Einnahmen/Ausgaben über KATEGORIE-BEITRÄGE statt über
 * ganze Buchungen: eine aufgeteilte Buchung zählt mit jedem Anteil in seiner
 * eigenen Kategorie, und `matches` grenzt auf die gefilterte Kategorie ein.
 *
 * Damit stimmen die Kennzahlen einer kategoriegefilterten Liste mit dem
 * überein, was die Liste zeigt: Wer „Kleidung" filtert, sieht bei einer auf
 * Lebensmittel+Kleidung aufgeteilten Aldi-Buchung nur den Kleidungs-Anteil in
 * den Ausgaben — nicht den vollen Buchungsbetrag.
 *
 * Summiert in Integer-Cent (AGENTS.md §8) und erst am Ende zurück nach Euro.
 */
export function sumCategoryFlow(
  transactions: Transaction[],
  allocationsByTx: Map<string, TransactionAllocation[]> | undefined,
  matches: (assignedId: string | null) => boolean,
): { income: number; expenses: number } {
  const incomeParts: Cents[] = [];
  const expenseParts: Cents[] = [];
  for (const t of transactions) {
    if (t.is_transfer) continue;
    for (const contribution of getCategoryContributions(t, allocationsByTx)) {
      if (!matches(contribution.assignedId)) continue;
      const minor = toMinor(contribution.amount);
      if (minor > 0) incomeParts.push(minor);
      else if (minor < 0) expenseParts.push((-minor) as Cents);
    }
  }
  return { income: toMajor(sumMinor(incomeParts)), expenses: toMajor(sumMinor(expenseParts)) };
}

const UNCATEGORIZED_ID = "__uncategorized_main";
function uncategorizedName(): string {
  return translate("analysisDataService.uncategorized", "Unkategorisiert");
}

export type ResolvedHierarchy = {
  mainId: string;
  mainName: string;
  subId: string | null;
  subName: string | null;
};

/**
 * Löst Haupt-/Unterkategorie-Namen für eine (Unter-)Kategorie-ID auf (bis zur
 * Wurzel der parent_id-Kette). Exportiert, damit income-streams.ts dieselbe
 * Hierarchie-Auflösung wie die Sankey-/Sunburst-Aggregation nutzt, statt sie
 * zu duplizieren.
 */
export function resolveHierarchy(byId: Map<string, Category>, catId: string | null | undefined): ResolvedHierarchy {
  if (!catId) {
    return { mainId: UNCATEGORIZED_ID, mainName: uncategorizedName(), subId: null, subName: null };
  }
  const cat = byId.get(catId);
  if (!cat) {
    return { mainId: UNCATEGORIZED_ID, mainName: uncategorizedName(), subId: null, subName: null };
  }

  // Bis zur Wurzel laufen (Zyklus-Schutz über visited-Set).
  let main: Category = cat;
  let current: Category | undefined = cat;
  const visited = new Set<string>();
  while (current && current.parent_id) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    const parent = byId.get(current.parent_id);
    if (!parent) break;
    main = parent;
    current = parent;
  }

  if (main.id === cat.id) {
    return { mainId: main.id, mainName: main.name, subId: null, subName: null };
  }
  return { mainId: main.id, mainName: main.name, subId: cat.id, subName: cat.name };
}

/**
 * Effektive Ausgabenklasse einer (Unter-)Kategorie: läuft die parent-Kette
 * hoch und nimmt die erste gesetzte `attributes.ausgabenklasse`. So erben
 * Unterkategorien ohne eigenes Flag von ihrer Hauptkategorie.
 */
export function resolveAusgabenklasse(
  byId: Map<string, Category>,
  catId: string | null | undefined
): Ausgabenklasse | null {
  if (!catId) return null;
  let current: Category | undefined = byId.get(catId);
  const visited = new Set<string>();
  while (current) {
    if (current.attributes?.ausgabenklasse) return current.attributes.ausgabenklasse;
    if (!current.parent_id || visited.has(current.id)) break;
    visited.add(current.id);
    current = byId.get(current.parent_id);
  }
  return null;
}

/**
 * Löst den Essenziell-Status über die Kategorie-Hierarchie auf (nächster
 * definierter Wert, Unterkategorie überschreibt Hauptkategorie). Analog zu
 * resolveAusgabenklasse, damit Filter und Charts dieselbe Einstufung nutzen
 * (F-UX-5). `null`, wenn nirgends definiert.
 */
export function resolveEssenziell(
  byId: Map<string, Category>,
  catId: string | null | undefined
): boolean | null {
  if (!catId) return null;
  let current: Category | undefined = byId.get(catId);
  const visited = new Set<string>();
  while (current) {
    if (current.attributes?.essenziell !== undefined) {
      return current.attributes.essenziell === true;
    }
    if (!current.parent_id || visited.has(current.id)) break;
    visited.add(current.id);
    current = byId.get(current.parent_id);
  }
  return null;
}
