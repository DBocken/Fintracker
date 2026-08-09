import { parseISO, format } from "date-fns";
import type { Category, Transaction, TransactionAllocation } from "@/types";
import { t as translate } from "@/i18n/serviceT";
import {
  getCategoryContributions,
  resolveAusgabenklasse,
  resolveHierarchy,
} from "@/lib/analysis-data";

// -----------------------------------------------------------------------------
// Einnahmen-Aufschlüsselung ("Woher kommt mein Geld?") — Spiegelbild der
// Ausgaben-Sunburst-Aufschlüsselung, gruppiert nach Einkommens-Hauptkategorien.
//
// Lag bis WP 6.6 in `analysis-data.ts` (ARCH-6, Gott-Modul mit ≥5 Themen).
// Verschoben wurde ausschließlich der Ort — Verhalten und Zusicherungen sind
// unverändert.
// -----------------------------------------------------------------------------

const NON_INCOME_ID = "__nonincome";
function otherInflowsName(): string {
  return translate("analysisDataService.otherInflows", "Sonstige Zuflüsse");
}

export interface IncomeBreakdownChild {
  id: string;
  name: string;
  value: number;
  /** Anteil am Gruppen-Wert (0..1). */
  share: number;
}

export interface IncomeBreakdownGroup {
  id: string;
  name: string;
  value: number;
  /** Anteil an der Gesamtsumme (0..1). */
  share: number;
  children: IncomeBreakdownChild[];
}

export interface IncomeBreakdown {
  total: number;
  groups: IncomeBreakdownGroup[];
}

/**
 * Aggregiert positive, transferbereinigte Buchungen nach Einkommens-Haupt-
 * und Unterkategorie (Spiegelbild von buildSpendingSunburst/-Breakdown für
 * Ausgaben). Positive Buchungen in einer Nicht-Einkommens-Kategorie (z. B.
 * eine Versicherungserstattung auf einer Ausgaben-Kategorie) landen in der
 * synthetischen Gruppe "Sonstige Zuflüsse", statt die Einkommens-Summe zu
 * verfälschen oder verworfen zu werden.
 */
export function buildIncomeBreakdown(
  transactions: Transaction[],
  categories: Category[],
  allocationsByTx?: Map<string, TransactionAllocation[]>,
): IncomeBreakdown {
  const byId = new Map<string, Category>();
  for (const c of categories) byId.set(c.id, c);

  const groups = new Map<string, { id: string; name: string; value: number; children: Map<string, IncomeBreakdownChild> }>();
  let total = 0;

  for (const t of transactions) {
    if (t.is_transfer) continue;
    if (!(t.amount > 0)) continue;

    for (const c of getCategoryContributions(t, allocationsByTx)) {
      if (!(c.amount > 0)) continue;
      total += c.amount;

      const klasse = resolveAusgabenklasse(byId, c.assignedId);
      const { mainId, mainName, subId, subName } =
        klasse === "einkommen" || !c.assignedId
          ? resolveHierarchy(byId, c.assignedId)
          : { mainId: NON_INCOME_ID, mainName: otherInflowsName(), subId: null, subName: null };

      const group = groups.get(mainId) ?? { id: mainId, name: mainName, value: 0, children: new Map() };
      group.value += c.amount;

      if (subId) {
        const child = group.children.get(subId) ?? { id: subId, name: subName ?? subId, value: 0, share: 0 };
        child.value += c.amount;
        group.children.set(subId, child);
      }
      groups.set(mainId, group);
    }
  }

  const result: IncomeBreakdownGroup[] = [...groups.values()]
    .map((g) => ({
      id: g.id,
      name: g.name,
      value: g.value,
      share: total > 0 ? g.value / total : 0,
      children: [...g.children.values()]
        .map((c) => ({ ...c, share: g.value > 0 ? c.value / g.value : 0 }))
        .sort((a, b) => b.value - a.value),
    }))
    .sort((a, b) => b.value - a.value);

  return { total, groups: result };
}

export interface IncomeOverTimePoint {
  /** yyyy-MM */
  month: string;
  total: number;
  byMain: Record<string, number>;
}

/**
 * Aggregiert positive, transferbereinigte Buchungen je Kalendermonat und
 * Einkommens-Hauptkategorie — Grundlage für den Einnahmen-Verlaufs-Chart.
 * Monate ohne Einnahmen fehlen (keine Nullpunkte), aufsteigend sortiert.
 */
export function buildIncomeOverTime(
  transactions: Transaction[],
  categories: Category[],
  allocationsByTx?: Map<string, TransactionAllocation[]>,
): IncomeOverTimePoint[] {
  const byId = new Map<string, Category>();
  for (const c of categories) byId.set(c.id, c);

  const points = new Map<string, IncomeOverTimePoint>();

  for (const t of transactions) {
    if (t.is_transfer) continue;
    if (!(t.amount > 0)) continue;

    const parsed = parseISO(t.date);
    if (Number.isNaN(parsed.getTime())) continue;
    const month = format(parsed, "yyyy-MM");

    for (const c of getCategoryContributions(t, allocationsByTx)) {
      if (!(c.amount > 0)) continue;

      const klasse = resolveAusgabenklasse(byId, c.assignedId);
      const mainId =
        klasse === "einkommen" || !c.assignedId
          ? resolveHierarchy(byId, c.assignedId).mainId
          : NON_INCOME_ID;

      const point = points.get(month) ?? { month, total: 0, byMain: {} };
      point.total += c.amount;
      point.byMain[mainId] = (point.byMain[mainId] ?? 0) + c.amount;
      points.set(month, point);
    }
  }

  return [...points.values()].sort((a, b) => a.month.localeCompare(b.month));
}
