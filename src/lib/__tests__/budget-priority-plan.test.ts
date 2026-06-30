import { describe, expect, it } from "vitest";
import {
  computePriorityCutPlan,
  resolvePrioritaet,
  type PriorityCutItem,
} from "@/lib/budget-priority-plan";

const item = (p: Partial<PriorityCutItem>): PriorityCutItem => ({
  category: "X",
  monthlyAmount: 100,
  maxCut: 50,
  prioritaet: "normal",
  ...p,
});

describe("budget-priority-plan", () => {
  describe("resolvePrioritaet", () => {
    it("sollte fehlende Priorität als 'normal' behandeln", () => {
      expect(resolvePrioritaet(undefined)).toBe("normal");
      expect(resolvePrioritaet(null)).toBe("normal");
      expect(resolvePrioritaet("nice")).toBe("nice");
    });
  });

  describe("Wasserfall: niedrige Priorität zuerst", () => {
    it("sollte Nice-to-have vor Normal kürzen", () => {
      const plan = computePriorityCutPlan(
        [
          item({ category: "Essen", maxCut: 80, prioritaet: "normal" }),
          item({ category: "Streaming", maxCut: 30, prioritaet: "nice" }),
        ],
        20,
      );
      // Ziel 20 € ist allein aus dem Nice-to-have (Streaming) deckbar.
      expect(plan.suggestions[0].category).toBe("Streaming");
      expect(plan.totalCut).toBe(20);
      expect(plan.suggestions).toHaveLength(1);
      expect(plan.targetReached).toBe(true);
    });

    it("sollte erst die ganze Nice-Stufe ausschöpfen, bevor Normal angefasst wird", () => {
      const plan = computePriorityCutPlan(
        [
          item({ category: "Essen", maxCut: 80, prioritaet: "normal" }),
          item({ category: "Streaming", maxCut: 30, prioritaet: "nice" }),
          item({ category: "Fitness", maxCut: 25, prioritaet: "nice" }),
        ],
        70,
      );
      // 30 (Streaming) + 25 (Fitness) = 55 aus Nice, dann 15 aus Essen.
      const order = plan.suggestions.map((s) => s.category);
      expect(order).toEqual(["Streaming", "Fitness", "Essen"]);
      expect(plan.suggestions[2].suggestedCut).toBe(15);
      expect(plan.totalCut).toBe(70);
      expect(plan.targetReached).toBe(true);
    });
  });

  describe("Schutz & Grenzen", () => {
    it("sollte essenzielle Kategorien niemals kürzen", () => {
      const plan = computePriorityCutPlan(
        [
          item({ category: "Miete", maxCut: 500, prioritaet: "essential" }),
          item({ category: "Streaming", maxCut: 30, prioritaet: "nice" }),
        ],
        1000,
      );
      expect(plan.protectedCategories).toContain("Miete");
      expect(plan.suggestions.every((s) => s.category !== "Miete")).toBe(true);
      // Ziel nicht erreichbar, weil Essenzielles geschützt bleibt.
      expect(plan.targetReached).toBe(false);
      expect(plan.totalCut).toBe(30);
    });

    it("sollte pro Kategorie nicht über die realistische Kürzungsgrenze gehen", () => {
      const plan = computePriorityCutPlan([item({ category: "Essen", maxCut: 40 })], 100);
      expect(plan.suggestions[0].suggestedCut).toBe(40);
      expect(plan.targetReached).toBe(false);
    });

    it("[Edge] sollte ohne Ziel das volle Potenzial nach Priorität sortiert zeigen", () => {
      const plan = computePriorityCutPlan(
        [
          item({ category: "Essen", maxCut: 40, prioritaet: "normal" }),
          item({ category: "Streaming", maxCut: 30, prioritaet: "nice" }),
        ],
        0,
      );
      expect(plan.suggestions.map((s) => s.category)).toEqual(["Streaming", "Essen"]);
      expect(plan.totalCut).toBe(70);
      expect(plan.targetReached).toBe(true);
    });

    it("[Edge] sollte Positionen ohne Kürzungsspielraum überspringen", () => {
      const plan = computePriorityCutPlan(
        [item({ category: "Fix", maxCut: 0 }), item({ category: "Essen", maxCut: 20 })],
        50,
      );
      expect(plan.suggestions.map((s) => s.category)).toEqual(["Essen"]);
    });
  });

  describe("Verträge im Wasserfall (kind)", () => {
    it("sollte einen kündbaren Vertrag (nice) vor variablen Ausgaben kürzen und als 'contract' markieren", () => {
      const plan = computePriorityCutPlan(
        [
          item({ category: "Essen", maxCut: 80, prioritaet: "normal", kind: "variable" }),
          item({ category: "Netflix", monthlyAmount: 15, maxCut: 15, prioritaet: "nice", kind: "contract" }),
        ],
        15,
      );
      expect(plan.suggestions[0].category).toBe("Netflix");
      expect(plan.suggestions[0].kind).toBe("contract");
      expect(plan.suggestions[0].newBudget).toBe(0); // ganz gekündigt
    });

    it("sollte ohne kind 'variable' als Default setzen", () => {
      const plan = computePriorityCutPlan([item({ category: "Essen", maxCut: 20 })], 0);
      expect(plan.suggestions[0].kind).toBe("variable");
    });
  });
});
