// Liquiditäts-Wasserfall: reale Eingaben aus den Transaktionen zusammenstellen
// und an die reine Engine (budget-waterfall) übergeben.
//
// Einkommen/Fixkosten/variable Töpfe = Median der letzten Monate je Ausgabenklasse
// (robust gegen Ausreißer). Sparen = Pay-yourself-first-Ziel (Default 10 %).

import type { Ausgabenklasse, Category } from "@/types";
import type { WaterfallInput, WaterfallResult } from "@/lib/budget-waterfall";
import { computeWaterfall } from "@/lib/budget-waterfall";
import { median } from "@/lib/budget-adaptive";
import { monthKeyOf } from "@/lib/budget-logic";
import { currentMonthKey, lastNMonths } from "./budget-service";
import { getCategories, getTransactions } from "./transaction-service";
import { getAllocationMap } from "./transaction-allocation-service";
import { getCategoryContributions } from "@/lib/analysis-data";

const WINDOW_MONTHS = 6;
const DEFAULT_SAVINGS: WaterfallInput["savings"] = { mode: "percent", value: 10 };

export interface WaterfallPlan extends WaterfallResult {
  /** Anzahl Monate mit Einkommensdaten (Konfidenz). */
  monthsAnalyzed: number;
  savings: WaterfallInput["savings"];
}

/**
 * Erstellt den Wasserfall-Plan aus echten Daten. `savings` ist das
 * Pay-yourself-first-Ziel (Prozent oder Betrag); Default 10 %.
 */
export async function getWaterfallPlan(
  savings: WaterfallInput["savings"] = DEFAULT_SAVINGS,
  reference: Date = new Date(),
): Promise<WaterfallPlan> {
  const [categories, transactions, allocationsByTx] = await Promise.all([
    getCategories(),
    getTransactions(5000),
    getAllocationMap(),
  ]);

  // Ausgabenklasse je Kategorie-ID auflösen (Unterkategorie erbt von der Hauptkategorie).
  const byId = new Map(categories.map((c) => [c.id, c]));
  const klasseOf = (id: string): Ausgabenklasse | undefined => {
    const cat: Category | undefined = byId.get(id);
    if (!cat) return undefined;
    return cat.attributes?.ausgabenklasse ?? (cat.parent_id ? byId.get(cat.parent_id)?.attributes?.ausgabenklasse : undefined);
  };

  const months = lastNMonths(currentMonthKey(reference), WINDOW_MONTHS);
  const monthSet = new Set(months);
  const income = new Map<string, number>();
  const essentials = new Map<string, number>();
  const discretionary = new Map<string, number>();
  const add = (m: Map<string, number>, key: string, v: number) => m.set(key, (m.get(key) ?? 0) + v);

  for (const tx of transactions) {
    if (tx.is_transfer) continue;
    const mk = monthKeyOf(tx.date);
    if (!monthSet.has(mk)) continue;
    for (const c of getCategoryContributions(tx, allocationsByTx)) {
      if (!c.assignedId) continue;
      const klasse = klasseOf(c.assignedId);
      if (klasse === "einkommen" && c.amount > 0) add(income, mk, c.amount);
      else if (klasse === "essenziell" && c.amount < 0) add(essentials, mk, Math.abs(c.amount));
      else if (klasse === "diskretionaer" && c.amount < 0) add(discretionary, mk, Math.abs(c.amount));
    }
  }

  // Median über Monate mit echten Werten (Nullmonate = fehlende Historie, ausgenommen).
  const medianOf = (m: Map<string, number>) => median(months.map((k) => m.get(k) ?? 0).filter((v) => v > 0));
  const incomeVals = months.map((k) => income.get(k) ?? 0).filter((v) => v > 0);

  const result = computeWaterfall({
    income: median(incomeVals),
    savings,
    essentials: medianOf(essentials),
    discretionaryRequested: medianOf(discretionary),
  });

  return { ...result, monthsAnalyzed: incomeVals.length, savings };
}
