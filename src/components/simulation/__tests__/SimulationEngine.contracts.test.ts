import { describe, expect, it } from "vitest";
import { addMonths, startOfMonth, format } from "date-fns";
import { SimulationEngine } from "../SimulationEngine";
import type { Category, Transaction } from "@/types";

// Erzeugt die letzten n Monats-Keys (yyyy-MM), inkl. aktuellem Monat.
function lastMonths(n: number): string[] {
  const start = startOfMonth(new Date());
  return Array.from({ length: n }, (_, i) => format(addMonths(start, -(n - 1 - i)), "yyyy-MM"));
}

let idc = 0;
function tx(categoryId: string, month: string, amount: number): Transaction {
  return {
    id: `t${idc++}`,
    date: `${month}-15`,
    payee: "",
    description: "",
    original_text: "",
    amount,
    currency: "EUR",
    category_id: categoryId,
    subcategory_id: null,
    auto_mapped: false,
    confirmed: false,
  } as Transaction;
}

function cat(id: string, name: string, attributes: Category["attributes"] = {}): Category {
  return { id, name, parent_id: null, attributes } as Category;
}

describe("SimulationEngine – Vertrags-/Variablen-Trennung", () => {
  const months = lastMonths(6);

  it("erkennt ein stabil wiederkehrendes Fitness-Abo als Vertrag (nicht variabel)", () => {
    const categories = [cat("fit", "Fitnessstudio"), cat("food", "Lebensmittel")];
    const txs: Transaction[] = [];
    // Fitness: konstant 24,99 €/Monat über 6 Monate -> Vertrag
    for (const m of months) txs.push(tx("fit", m, -24.99));
    // Lebensmittel: stark schwankend -> variabel
    const foodAmounts = [-120, -260, -90, -300, -150, -220];
    months.forEach((m, i) => txs.push(tx("food", m, foodAmounts[i])));

    const engine = new SimulationEngine(txs, categories);
    const variableIds = engine.getVariableCategoryStats(12).map((s) => s.categoryId);
    expect(variableIds).toContain("food");
    expect(variableIds).not.toContain("fit");

    const contractIds = engine.getDetectedContracts().map((c) => c.categoryId);
    expect(contractIds).toContain("fit");
  });

  it("schlägt Bündelung bei mehreren Streaming-Abos mit konkreter Ersparnis vor", () => {
    const categories = [
      cat("nf", "Netflix"),
      cat("sp", "Spotify"),
      cat("dz", "Disney Plus"),
    ];
    const txs: Transaction[] = [];
    for (const m of months) {
      txs.push(tx("nf", m, -18));
      txs.push(tx("sp", m, -10));
      txs.push(tx("dz", m, -9));
    }

    const engine = new SimulationEngine(txs, categories);
    const actions = engine.generateContractActions();
    const bundle = actions.find((a) => a.domain === "Streaming" && a.kind === "bundle");
    expect(bundle).toBeTruthy();
    // 18+10+9 = 37, günstigster 9 -> Ersparnis 28
    expect(bundle!.monthlySavingsEstimate).toBe(28);
    expect(bundle!.categoryIds.sort()).toEqual(["dz", "nf", "sp"]);
  });

  it("Vertragskategorien tauchen nicht als prozentuale Kürzung im Survival-Plan auf", () => {
    const categories = [cat("nf", "Netflix"), cat("sp", "Spotify"), cat("food", "Lebensmittel")];
    const txs: Transaction[] = [];
    for (const m of months) {
      txs.push(tx("nf", m, -18));
      txs.push(tx("sp", m, -10));
    }
    const foodAmounts = [-120, -260, -90, -300, -150, -220];
    months.forEach((m, i) => txs.push(tx("food", m, foodAmounts[i])));

    const engine = new SimulationEngine(txs, categories);
    const plan = engine.generateSurvivalPlan(new Set(), 1);
    const ids = plan.suggestions.map((s) => s.categoryId);
    expect(ids).not.toContain("nf");
    expect(ids).not.toContain("sp");
    // Jeder variable Vorschlag trägt eine Begründung.
    expect(plan.suggestions.every((s) => !!s.reason)).toBe(true);
  });
});
