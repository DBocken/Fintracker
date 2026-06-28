import { parseISO, getDay } from "date-fns";
import type { Account, Ausgabenklasse, Category, Transaction, TransactionAllocation } from "@/types";

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
 * Gemeinsame, pure Daten-Aufbereitung für das Basis-Dashboard und den
 * Analyse-Bereich (Issue #40). Eine Implementierung für beide Sankey-Ebenen:
 * das Basis-Dashboard zeigt nur Hauptkategorien, der Analyse-Bereich
 * zusätzlich den Drilldown in Unterkategorien.
 */

export interface SankeyMainCategory {
  id: string;
  name: string;
  amount: number;
  byAccount: Record<string, number>;
}

export interface SankeySubCategory {
  id: string;
  name: string;
  amount: number;
  mainId: string;
  mainName: string;
  byAccount: Record<string, number>;
}

export interface SankeyAccountNode {
  id: string;
  name: string;
  income: number;
  expenses: number;
  net: number;
  color?: string;
}

export interface SankeyData {
  totalIncome: number;
  accounts: SankeyAccountNode[];
  mainCategories: SankeyMainCategory[];
  subCategories: SankeySubCategory[];
}

export interface SankeyKlasseNode {
  id: string;
  name: string;
  amount: number;
  byAccount: Record<string, number>;
}

export interface SankeyDataByKlasse {
  totalIncome: number;
  accounts: SankeyAccountNode[];
  klassen: SankeyKlasseNode[];
  mainCategories: SankeyMainCategory[];
  subCategories: SankeySubCategory[];
}

const UNCATEGORIZED_ID = "__uncategorized_main";
const UNCATEGORIZED_NAME = "Unkategorisiert";
const UNASSIGNED_ACCOUNT_ID = "__unassigned_account";
const UNASSIGNED_ACCOUNT_NAME = "Sonstiges Konto";

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
 * Hauptkategorie und je Unterkategorie sowie Einnahmen/Ausgaben/Netto je
 * Konto (für die Konto-Knoten im Sankey-Diagramm). Beträge sind positive
 * Absolutwerte.
 */
export function buildSankeyData(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[] = [],
  allocationsByTx?: Map<string, TransactionAllocation[]>
): SankeyData {
  const byId = new Map<string, Category>();
  for (const c of categories) byId.set(c.id, c);

  const accountById = new Map<string, Account>();
  for (const a of accounts) accountById.set(a.id, a);

  let totalIncome = 0;
  const mains = new Map<string, SankeyMainCategory>();
  const subs = new Map<string, SankeySubCategory>();
  const accountTotals = new Map<string, { income: number; expenses: number }>();

  const getAccountTotals = (id: string) => {
    let entry = accountTotals.get(id);
    if (!entry) {
      entry = { income: 0, expenses: 0 };
      accountTotals.set(id, entry);
    }
    return entry;
  };

  for (const t of transactions) {
    if (t.is_transfer) continue;
    const accountId = t.account_id ?? UNASSIGNED_ACCOUNT_ID;

    if (t.amount > 0) {
      totalIncome += t.amount;
      getAccountTotals(accountId).income += t.amount;
      continue;
    }
    if (t.amount === 0) continue;

    const assignedId = t.subcategory_id ?? t.category_id ?? null;
    // Negative Buchungen in einer Einkommens-Kategorie sind Einkommens-
    // Korrekturen, keine Ausgaben — nicht in die Ausgaben-Knoten aufnehmen.
    if (resolveAusgabenklasse(byId, assignedId) === "einkommen") continue;

    // Kontosummen bleiben transaktionsbezogen (nur Originalbuchung zählt).
    getAccountTotals(accountId).expenses += Math.abs(t.amount);

    // Kategorie-Aufschlüsselung über Aufteilungen, falls vorhanden.
    for (const c of getCategoryContributions(t, allocationsByTx)) {
      if (resolveAusgabenklasse(byId, c.assignedId) === "einkommen") continue;
      const cAbs = Math.abs(c.amount);
      const { mainId, mainName, subId, subName } = resolveHierarchy(byId, c.assignedId);

      const main = mains.get(mainId) ?? { id: mainId, name: mainName, amount: 0, byAccount: {} };
      main.amount += cAbs;
      main.byAccount[accountId] = (main.byAccount[accountId] ?? 0) + cAbs;
      mains.set(mainId, main);

      if (subId && subName) {
        const key = subId;
        const sub = subs.get(key) ?? { id: subId, name: subName, amount: 0, mainId, mainName, byAccount: {} };
        sub.amount += cAbs;
        sub.byAccount[accountId] = (sub.byAccount[accountId] ?? 0) + cAbs;
        subs.set(key, sub);
      }
    }
  }

  const accountNodes: SankeyAccountNode[] = [...accountTotals.entries()]
    .filter(([, totals]) => totals.income > 0 || totals.expenses > 0)
    .map(([id, totals]) => {
      const account = accountById.get(id);
      return {
        id,
        name: account?.name ?? UNASSIGNED_ACCOUNT_NAME,
        income: totals.income,
        expenses: totals.expenses,
        net: totals.income - totals.expenses,
        color: account?.color,
      };
    })
    .sort((a, b) => b.income + b.expenses - (a.income + a.expenses));

  return {
    totalIncome,
    accounts: accountNodes,
    mainCategories: [...mains.values()].filter((m) => m.amount > 0).sort((a, b) => b.amount - a.amount),
    subCategories: [...subs.values()].filter((s) => s.amount > 0).sort((a, b) => b.amount - a.amount),
  };
}

/**
 * Wie buildSankeyData, aber mit zusätzlicher Aggregation nach Ausgabenklasse.
 * Erzeugt einen vierstufigen Sankey: Income → Accounts → Klassen → Hauptkategorien.
 */
export function buildSankeyDataByKlasse(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[] = [],
  allocationsByTx?: Map<string, TransactionAllocation[]>
): SankeyDataByKlasse {
  const byId = new Map<string, Category>();
  for (const c of categories) byId.set(c.id, c);

  const accountById = new Map<string, Account>();
  for (const a of accounts) accountById.set(a.id, a);

  let totalIncome = 0;
  const klassen = new Map<string, SankeyKlasseNode>();
  const mains = new Map<string, SankeyMainCategory>();
  const subs = new Map<string, SankeySubCategory>();
  const accountTotals = new Map<string, { income: number; expenses: number }>();

  const getAccountTotals = (id: string) => {
    let entry = accountTotals.get(id);
    if (!entry) {
      entry = { income: 0, expenses: 0 };
      accountTotals.set(id, entry);
    }
    return entry;
  };

  const KLASSE_LABELS: Record<string, string> = {
    essenziell: "Essenziell",
    diskretionaer: "Nicht-Essenziell",
    sparen: "Sparen",
    unkategorisiert: "Unkategorisiert",
  };

  for (const t of transactions) {
    if (t.is_transfer) continue;
    const accountId = t.account_id ?? UNASSIGNED_ACCOUNT_ID;

    if (t.amount > 0) {
      totalIncome += t.amount;
      getAccountTotals(accountId).income += t.amount;
      continue;
    }
    if (t.amount === 0) continue;

    const txAssignedId = t.subcategory_id ?? t.category_id ?? null;

    // Negative Buchungen in einer Einkommens-Kategorie sind Einkommens-
    // Korrekturen, keine Ausgaben — aus der Ausgaben-Aufschlüsselung ausnehmen.
    if (resolveAusgabenklasse(byId, txAssignedId) === "einkommen") continue;

    // Kontosummen bleiben transaktionsbezogen (nur Originalbuchung zählt).
    getAccountTotals(accountId).expenses += Math.abs(t.amount);

    for (const c of getCategoryContributions(t, allocationsByTx)) {
      const klasse = resolveAusgabenklasse(byId, c.assignedId) ?? null;
      if (klasse === "einkommen") continue;

      const cAbs = Math.abs(c.amount);
      const { mainId, mainName, subId, subName } = resolveHierarchy(byId, c.assignedId);
      const klasseId = klasse ?? "unkategorisiert";
      const klasseName = KLASSE_LABELS[klasseId] || "Unkategorisiert";

      // Klasse aggregation
      const klasseNode = klassen.get(klasseId) ?? { id: klasseId, name: klasseName, amount: 0, byAccount: {} };
      klasseNode.amount += cAbs;
      klasseNode.byAccount[accountId] = (klasseNode.byAccount[accountId] ?? 0) + cAbs;
      klassen.set(klasseId, klasseNode);

      // Main category aggregation
      const main = mains.get(mainId) ?? { id: mainId, name: mainName, amount: 0, byAccount: {} };
      main.amount += cAbs;
      main.byAccount[accountId] = (main.byAccount[accountId] ?? 0) + cAbs;
      mains.set(mainId, main);

      if (subId && subName) {
        const key = subId;
        const sub = subs.get(key) ?? { id: subId, name: subName, amount: 0, mainId, mainName, byAccount: {} };
        sub.amount += cAbs;
        sub.byAccount[accountId] = (sub.byAccount[accountId] ?? 0) + cAbs;
        subs.set(key, sub);
      }
    }
  }

  const accountNodes: SankeyAccountNode[] = [...accountTotals.entries()]
    .filter(([, totals]) => totals.income > 0 || totals.expenses > 0)
    .map(([id, totals]) => {
      const account = accountById.get(id);
      return {
        id,
        name: account?.name ?? UNASSIGNED_ACCOUNT_NAME,
        income: totals.income,
        expenses: totals.expenses,
        net: totals.income - totals.expenses,
        color: account?.color,
      };
    })
    .sort((a, b) => b.income + b.expenses - (a.income + a.expenses));

  return {
    totalIncome,
    accounts: accountNodes,
    klassen: [...klassen.values()].filter((k) => k.amount > 0).sort((a, b) => b.amount - a.amount),
    mainCategories: [...mains.values()].filter((m) => m.amount > 0).sort((a, b) => b.amount - a.amount),
    subCategories: [...subs.values()].filter((s) => s.amount > 0).sort((a, b) => b.amount - a.amount),
  };
}

// -----------------------------------------------------------------------------
// Sunburst: Superkategorie (Ausgabenklasse) -> Hauptkategorie
// -----------------------------------------------------------------------------

/**
 * Stabile IDs der vorgelagerten Ausgabenklassen (Sunburst-Innenring). Hält die
 * Hauptkategorien-Vielfalt aus dem Innenring heraus und macht Diagramme lesbar.
 */
export type SunburstSuperId = "essenziell" | "diskretionaer" | "sparen" | "unkategorisiert";

export const SUNBURST_SUPER_LABEL: Record<SunburstSuperId, string> = {
  essenziell: "Essenziell",
  diskretionaer: "Nicht-Essenziell",
  sparen: "Sparen",
  unkategorisiert: "Unkategorisiert",
};

export interface SunburstInner {
  id: string;
  name: string;
  value: number;
}
export interface SunburstOuter {
  id: string;
  parentId: string;
  name: string;
  value: number;
}
export interface SpendingSunburst {
  inner: SunburstInner[];
  outer: SunburstOuter[];
  total: number;
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

function toSuperId(klasse: Ausgabenklasse | null, hasAssignment: boolean): SunburstSuperId {
  if (!hasAssignment) return "unkategorisiert";
  if (klasse === "essenziell") return "essenziell";
  if (klasse === "sparen") return "sparen";
  return "diskretionaer"; // diskretionaer, einkommen, null
}

/**
 * Aggregiert Ausgaben zum Sunburst: Innenring = Ausgabenklasse
 * (Essenziell/Nicht-Essenziell/Sparen), Außenring = Hauptkategorie je Klasse.
 * `transactions` sollte bereits transfer-bereinigt sein; `total` ist die Summe
 * aller Ausgaben (Absolutbeträge der negativen Beträge).
 */
export function buildSpendingSunburst(
  transactions: Transaction[],
  categories: Category[],
  allocationsByTx?: Map<string, TransactionAllocation[]>
): SpendingSunburst {
  const byId = new Map<string, Category>();
  for (const c of categories) byId.set(c.id, c);

  const innerMap = new Map<string, SunburstInner>();
  const outerMap = new Map<string, SunburstOuter>();
  let total = 0;

  for (const t of transactions) {
    if (t.is_transfer) continue;
    if (!(t.amount < 0)) continue;

    for (const c of getCategoryContributions(t, allocationsByTx)) {
      const klasse = resolveAusgabenklasse(byId, c.assignedId);
      // Negative Buchungen in einer Einkommens-Kategorie (z. B. Gehalts-
      // Rückbuchung) sind keine Ausgaben, sondern Einkommens-Korrekturen.
      // Sie gehören nicht in die Ausgaben-Aufschlüsselung.
      if (klasse === "einkommen") continue;

      const amount = Math.abs(c.amount);
      total += amount;

      const superId = toSuperId(klasse, Boolean(c.assignedId));

      const inner = innerMap.get(superId) ?? {
        id: superId,
        name: SUNBURST_SUPER_LABEL[superId],
        value: 0,
      };
      inner.value += amount;
      innerMap.set(superId, inner);

      // Unkategorisierte Ausgaben bekommen keinen Außenring (nur Innenring-Slice).
      if (superId === "unkategorisiert") continue;

      const { mainId, mainName } = resolveHierarchy(byId, c.assignedId);
      const outerKey = `${superId}::${mainId}`;
      const outer = outerMap.get(outerKey) ?? {
        id: outerKey,
        parentId: superId,
        name: mainName,
        value: 0,
      };
      outer.value += amount;
      outerMap.set(outerKey, outer);
    }
  }

  return {
    inner: [...innerMap.values()].sort((a, b) => b.value - a.value),
    outer: [...outerMap.values()].sort((a, b) => b.value - a.value),
    total,
  };
}

export interface SunburstBreakdownChild {
  /** Außenring-ID der Form `${superId}::${mainId}`. */
  id: string;
  name: string;
  value: number;
  /** Anteil am Eltern-Klassen-Wert (0..1). */
  share: number;
}
export interface SunburstBreakdownGroup {
  /** Klassen-ID (Innenring). */
  id: string;
  name: string;
  value: number;
  /** Anteil am Gesamt-Ausgabenwert (0..1). */
  share: number;
  children: SunburstBreakdownChild[];
}

/**
 * Verflacht die zwei Sunburst-Ringe in eine geordnete Eltern→Kind-Hierarchie
 * für die mobile, antippbare Aufschlüsselung. Während der Donut die tieferen
 * Ebenen nur per Hover zeigt (auf Touch unerreichbar), macht diese Struktur
 * jede Hauptkategorie je Klasse als Text + Anteilsbalken sichtbar.
 *
 * Gruppen folgen der Innenring-Reihenfolge (bereits nach Wert sortiert),
 * Kinder werden je Gruppe absteigend nach Wert sortiert. Anteile sind relativ:
 * Gruppe zur Gesamtsumme, Kind zum jeweiligen Klassen-Wert.
 */
export function buildSunburstBreakdown(sunburst: SpendingSunburst): SunburstBreakdownGroup[] {
  const childrenByParent = new Map<string, SunburstOuter[]>();
  for (const o of sunburst.outer ?? []) {
    const arr = childrenByParent.get(o.parentId) ?? [];
    arr.push(o);
    childrenByParent.set(o.parentId, arr);
  }

  const total = sunburst.total > 0 ? sunburst.total : (sunburst.inner ?? []).reduce((s, it) => s + it.value, 0);

  return (sunburst.inner ?? []).map((klasse) => {
    const rawChildren = (childrenByParent.get(klasse.id) ?? [])
      .slice()
      .sort((a, b) => b.value - a.value);
    const children: SunburstBreakdownChild[] = rawChildren.map((c) => ({
      id: c.id,
      name: c.name,
      value: c.value,
      share: klasse.value > 0 ? c.value / klasse.value : 0,
    }));
    return {
      id: klasse.id,
      name: klasse.name,
      value: klasse.value,
      share: total > 0 ? klasse.value / total : 0,
      children,
    };
  });
}

// -----------------------------------------------------------------------------
// Sunburst-Baum: mehrstufige Hierarchie (Klasse -> Hauptkategorie -> Unterkategorie)
// für das grafische, zoombare Sunburst-Diagramm.
// -----------------------------------------------------------------------------

export interface SunburstNode {
  /** Eindeutiger Pfad-Schlüssel, z. B. `essenziell::wohnen::miete`. */
  id: string;
  name: string;
  /** Ausgaben-Absolutbetrag (Summe der Nachkommen bei inneren Knoten). */
  value: number;
  /** Wurzel-Ausgabenklasse — steuert die Einfärbung über alle Ringe. */
  klasseId: SunburstSuperId;
  /** Kategorie-ID für die Navigation zu gefilterten Buchungen (null bei Klassen-Knoten). */
  categoryId: string | null;
  children: SunburstNode[];
}

export interface SunburstTree {
  total: number;
  children: SunburstNode[];
}

type SubAgg = { id: string; name: string; value: number };
type MainAgg = { id: string; name: string; value: number; directValue: number; subs: Map<string, SubAgg> };
type KlasseAgg = { id: SunburstSuperId; value: number; mains: Map<string, MainAgg>; directValue: number };

/**
 * Baut den hierarchischen Sunburst-Baum (bis zu drei Ebenen) aus Ausgaben.
 * Eltern-Werte sind exakt die Summe ihrer Kinder, damit die Ringe lückenlos
 * füllen: Hauptkategorien mit *zusätzlich* direkt (ohne Unterkategorie)
 * gebuchten Ausgaben erhalten dafür ein synthetisches „Ohne Unterkategorie"-
 * Kind. Unkategorisierte Ausgaben bleiben ein Blatt auf Klassen-Ebene.
 *
 * `transactions` sollte transfer-bereinigt sein; Einkommens-Korrekturen
 * (negative Buchungen in Einkommens-Kategorien) werden ausgenommen.
 */
export function buildSunburstTree(
  transactions: Transaction[],
  categories: Category[],
  allocationsByTx?: Map<string, TransactionAllocation[]>
): SunburstTree {
  const byId = new Map<string, Category>();
  for (const c of categories) byId.set(c.id, c);

  const klassen = new Map<SunburstSuperId, KlasseAgg>();
  let total = 0;

  const getKlasse = (id: SunburstSuperId): KlasseAgg => {
    let ka = klassen.get(id);
    if (!ka) {
      ka = { id, value: 0, mains: new Map(), directValue: 0 };
      klassen.set(id, ka);
    }
    return ka;
  };

  for (const t of transactions) {
    if (t.is_transfer) continue;
    if (!(t.amount < 0)) continue;

    for (const c of getCategoryContributions(t, allocationsByTx)) {
      const klasse = resolveAusgabenklasse(byId, c.assignedId);
      if (klasse === "einkommen") continue;

      const amount = Math.abs(c.amount);
      total += amount;

      const superId = toSuperId(klasse, Boolean(c.assignedId));
      const ka = getKlasse(superId);
      ka.value += amount;

      // Unkategorisierte Ausgaben bleiben ein Blatt — nichts zum Reinzoomen.
      if (superId === "unkategorisiert") {
        ka.directValue += amount;
        continue;
      }

      const { mainId, mainName, subId, subName } = resolveHierarchy(byId, c.assignedId);
      let ma = ka.mains.get(mainId);
      if (!ma) {
        ma = { id: mainId, name: mainName, value: 0, directValue: 0, subs: new Map() };
        ka.mains.set(mainId, ma);
      }
      ma.value += amount;

      if (subId && subName) {
        const sa = ma.subs.get(subId) ?? { id: subId, name: subName, value: 0 };
        sa.value += amount;
        ma.subs.set(subId, sa);
      } else {
        ma.directValue += amount;
      }
    }
  }

  const bySortValueDesc = <T extends { value: number }>(a: T, b: T) => b.value - a.value;

  const children: SunburstNode[] = [...klassen.values()]
    .filter((ka) => ka.value > 0)
    .sort(bySortValueDesc)
    .map((ka) => {
      const klasseNode: SunburstNode = {
        id: ka.id,
        name: SUNBURST_SUPER_LABEL[ka.id],
        value: ka.value,
        klasseId: ka.id,
        categoryId: null,
        children: [],
      };

      klasseNode.children = [...ka.mains.values()]
        .filter((ma) => ma.value > 0)
        .sort(bySortValueDesc)
        .map((ma) => {
          const mainNode: SunburstNode = {
            id: `${ka.id}::${ma.id}`,
            name: ma.name,
            value: ma.value,
            klasseId: ka.id,
            categoryId: ma.id,
            children: [],
          };

          if (ma.subs.size > 0) {
            mainNode.children = [...ma.subs.values()]
              .filter((sa) => sa.value > 0)
              .sort(bySortValueDesc)
              .map((sa) => ({
                id: `${ka.id}::${ma.id}::${sa.id}`,
                name: sa.name,
                value: sa.value,
                klasseId: ka.id,
                categoryId: sa.id,
                children: [],
              }));
            // Direkt (ohne Unterkategorie) gebuchter Rest füllt den Ring lückenlos.
            if (ma.directValue > 0) {
              mainNode.children.push({
                id: `${ka.id}::${ma.id}::__direct`,
                name: "Ohne Unterkategorie",
                value: ma.directValue,
                klasseId: ka.id,
                categoryId: ma.id,
                children: [],
              });
            }
          }

          return mainNode;
        });

      return klasseNode;
    });

  return { total, children };
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
