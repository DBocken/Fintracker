import type { Account, Category, Transaction, TransactionAllocation } from "@/types";
import { t as translate } from "@/i18n/serviceT";
import {
  getCategoryContributions,
  resolveAusgabenklasse,
  resolveHierarchy,
} from "@/lib/analysis-data";

/**
 * Gemeinsame, pure Daten-Aufbereitung für das Basis-Dashboard und den
 * Analyse-Bereich (Issue #40). Eine Implementierung für beide Sankey-Ebenen:
 * das Basis-Dashboard zeigt nur Hauptkategorien, der Analyse-Bereich
 * zusätzlich den Drilldown in Unterkategorien.
 *
 * Lag bis WP 6.6 in `analysis-data.ts` (ARCH-6, Gott-Modul mit ≥5 Themen).
 * Verschoben wurde ausschließlich der Ort — Verhalten und Zusicherungen sind
 * unverändert.
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

const UNASSIGNED_ACCOUNT_ID = "__unassigned_account";
function unassignedAccountName(): string {
  return translate("analysisDataService.unassignedAccount", "Sonstiges Konto");
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
        name: account?.name ?? unassignedAccountName(),
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
        name: account?.name ?? unassignedAccountName(),
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
