import { describe, it, expect } from "vitest";
import { computeWaterfall, resolveSavingsAmount } from "@/lib/budget-waterfall";

describe("budget-waterfall", () => {
  describe("resolveSavingsAmount", () => {
    it("sollte Prozent vom Einkommen rechnen", () => {
      expect(resolveSavingsAmount(3000, { mode: "percent", value: 10 })).toBe(300);
    });
    it("sollte festen Betrag durchreichen", () => {
      expect(resolveSavingsAmount(3000, { mode: "amount", value: 500 })).toBe(500);
    });
    it("sollte negative Werte auf 0 klemmen", () => {
      expect(resolveSavingsAmount(3000, { mode: "amount", value: -50 })).toBe(0);
      expect(resolveSavingsAmount(-100, { mode: "percent", value: 10 })).toBe(0);
    });
  });

  describe("computeWaterfall", () => {
    it("sollte Einkommen kaskadierend verteilen (Happy Path)", () => {
      const r = computeWaterfall({
        income: 3000,
        savings: { mode: "percent", value: 10 },
        essentials: 1500,
        discretionaryRequested: 800,
      });
      expect(r.steps.map((s) => [s.key, s.allocated])).toEqual([
        ["savings", 300],
        ["essentials", 1500],
        ["discretionary", 800],
        ["surplus", 400],
      ]);
      expect(r.surplus).toBe(400);
      expect(r.totalShortfall).toBe(0);
      expect(r.feasible).toBe(true);
      expect(r.savingsRate).toBeCloseTo(0.1);
      expect(r.steps.every((s) => s.funded)).toBe(true);
    });

    it("sollte variable Töpfe auf das Verfügbare kürzen (Null-Saldo)", () => {
      const r = computeWaterfall({
        income: 3000,
        savings: { mode: "amount", value: 300 },
        essentials: 1500,
        discretionaryRequested: 2000,
      });
      const disc = r.steps.find((s) => s.key === "discretionary")!;
      expect(disc.allocated).toBe(1200);
      expect(disc.shortfall).toBe(800);
      expect(disc.funded).toBe(false);
      expect(r.surplus).toBe(0);
      expect(r.feasible).toBe(true); // Sparen + Fixkosten passen noch
    });

    it("sollte bei zu aggressiver Sparquote die Fixkosten-Lücke als infeasible melden", () => {
      const r = computeWaterfall({
        income: 1000,
        savings: { mode: "percent", value: 20 }, // 200
        essentials: 1500,
        discretionaryRequested: 300,
      });
      const ess = r.steps.find((s) => s.key === "essentials")!;
      expect(r.steps[0].allocated).toBe(200); // Sparen zuerst
      expect(ess.allocated).toBe(800);
      expect(ess.shortfall).toBe(700);
      expect(r.feasible).toBe(false);
      expect(r.surplus).toBe(0);
      expect(r.totalShortfall).toBe(700 + 300); // Fixkosten + variable ungedeckt
    });

    describe("Edge Cases", () => {
      it("sollte mit Einkommen 0 umgehen", () => {
        const r = computeWaterfall({
          income: 0,
          savings: { mode: "percent", value: 10 },
          essentials: 500,
          discretionaryRequested: 200,
        });
        expect(r.surplus).toBe(0);
        expect(r.savingsRate).toBe(0);
        expect(r.feasible).toBe(false);
      });

      it("sollte ohne Sparen/Fixkosten alles als Überschuss ausweisen", () => {
        const r = computeWaterfall({
          income: 2000,
          savings: { mode: "amount", value: 0 },
          essentials: 0,
          discretionaryRequested: 0,
        });
        expect(r.surplus).toBe(2000);
        expect(r.feasible).toBe(true);
      });
    });
  });
});
