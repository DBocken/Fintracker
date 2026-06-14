import { parseISO, getDay } from "date-fns";
import type { Category, Transaction } from "@/types";

/**
 * Gemeinsame, pure Daten-Aufbereitung für das Basis-Dashboard und den
 * Analyse-Bereich (Issue #40). Eine Implementierung für beide Sankey-Ebenen:
 * das Basis-Dashboard zeigt nur Hauptkategorien, der Analyse-Bereich
 * zusätzlich den Drilldown in Unterkategorien.
 */

export interface SankeyMainCategory {
  id: string;
  name: string;
  amount: number;
}

export interface SankeySubCategory {
  id: string;
  name: string;
  amount: number;
  mainId: string;
  mainName: string;
}

export interface SankeyData {
  totalIncome: number;
  mainCategories: SankeyMainCategory[];
  subCategories: SankeySubCategory[];
}

const UNCATEGORIZED_ID = "__uncategorized_main";
const UNCATEGORIZED_NAME = "Unkategorisiert";

type ResolvedHierarchy = {
  mainId: string;
  mainName: string;
  subId: string | null;
  subName: string | null;
};

function resolveHierarchy(byId: Map<string, Category>, catId: string | null | undefined): ResolvedHierarchy {
  if (!catId) {
    return { mainId: UNCATEGORIZED_ID, mainName: UNCATEGORIZED_NAME, subId: null, subName: null };
  }
  const cat = byId.get(catId);
  if (!cat) {
    return { mainId: UNCATEGORIZED_ID, mainName: UNCATEGORIZED_NAME, subId: null, subName: null };
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
 * Aggregiert Transaktionen zu Sankey-Daten: Einnahmen-Summe, Ausgaben je
 * Hauptkategorie und je Unterkategorie. Beträge sind positive Absolutwerte.
 */
export function buildSankeyData(transactions: Transaction[], categories: Category[]): SankeyData {
  const byId = new Map<string, Category>();
  for (const c of categories) byId.set(c.id, c);

  let totalIncome = 0;
  const mains = new Map<string, SankeyMainCategory>();
  const subs = new Map<string, SankeySubCategory>();

  for (const t of transactions) {
    if (t.is_transfer) continue;
    if (t.amount > 0) {
      totalIncome += t.amount;
      continue;
    }
    if (t.amount === 0) continue;

    const amountAbs = Math.abs(t.amount);
    const assignedId = t.subcategory_id ?? t.category_id ?? null;
    const { mainId, mainName, subId, subName } = resolveHierarchy(byId, assignedId);

    const main = mains.get(mainId) ?? { id: mainId, name: mainName, amount: 0 };
    main.amount += amountAbs;
    mains.set(mainId, main);

    if (subId && subName) {
      const key = subId;
      const sub = subs.get(key) ?? { id: subId, name: subName, amount: 0, mainId, mainName };
      sub.amount += amountAbs;
      subs.set(key, sub);
    }
  }

  return {
    totalIncome,
    mainCategories: [...mains.values()].filter((m) => m.amount > 0).sort((a, b) => b.amount - a.amount),
    subCategories: [...subs.values()].filter((s) => s.amount > 0).sort((a, b) => b.amount - a.amount),
  };
}

export interface WeekdayPatternEntry {
  day: string;
  income: number;
  expenses: number;
}

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/**
 * Aggregiert Einnahmen/Ausgaben je Wochentag (Mo–So) für die
 * Wochenmuster-Charts im Analyse-Bereich.
 */
export function buildWeekdayPattern(transactions: Transaction[]): WeekdayPatternEntry[] {
  const buckets = WEEKDAY_LABELS.map((day) => ({ day, income: 0, expenses: 0 }));

  for (const t of transactions) {
    if (t.is_transfer) continue;
    const parsed = parseISO(t.date);
    if (Number.isNaN(parsed.getTime())) continue;
    // date-fns getDay: 0 = Sonntag → auf Mo-basierten Index drehen.
    const index = (getDay(parsed) + 6) % 7;
    if (t.amount > 0) buckets[index].income += t.amount;
    else buckets[index].expenses += Math.abs(t.amount);
  }

  return buckets;
}
