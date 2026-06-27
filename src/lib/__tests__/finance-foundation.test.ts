import { describe, it, expect } from "vitest";
import { computeFinanceFoundation, type FoundationInput } from "@/lib/finance-foundation";

const base: FoundationInput = {
  liquidBuffer: 0,
  monthlyExpenses: 2000,
  consumerDebt: 0,
  savingsRate: 0,
  goalsFunded: 0,
};

describe("finance-foundation", () => {
  it("sollte immer genau 6 geordnete Etappen liefern", () => {
    const r = computeFinanceFoundation(base);
    expect(r.stages).toHaveLength(6);
    expect(r.stages.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("sollte bei leerem Puffer in Etappe 1 (Starthilfe) starten", () => {
    const r = computeFinanceFoundation(base);
    expect(r.currentKey).toBe("starthilfe");
    expect(r.stages[0].status).toBe("active");
    // Etappe 2 ist ohne Schulden bereits erledigt; die nächste offene ist gesperrt.
    expect(r.stages[1].status).toBe("completed");
    expect(r.stages[2].status).toBe("locked");
  });

  it("sollte den Starthilfe-Fortschritt anteilig zum 1000-€-Ziel berechnen", () => {
    const r = computeFinanceFoundation({ ...base, liquidBuffer: 500 });
    expect(r.stages[0].progress).toBeCloseTo(0.5);
  });

  it("sollte bei vollem Starthilfe-Puffer + Schulden in Etappe 2 wechseln", () => {
    const r = computeFinanceFoundation({ ...base, liquidBuffer: 1000, consumerDebt: 3000 });
    expect(r.stages[0].status).toBe("completed");
    expect(r.currentKey).toBe("teure_schulden");
    expect(r.stages[1].progress).toBe(0);
  });

  it("sollte ohne Schulden Etappe 2 als erledigt überspringen und am Sicherheitspolster arbeiten", () => {
    const r = computeFinanceFoundation({ ...base, liquidBuffer: 1000, consumerDebt: 0, monthlyExpenses: 2000 });
    expect(r.stages[1].status).toBe("completed");
    expect(r.currentKey).toBe("sicherheitspolster");
    // 1000 € / 2000 € / 3 Monate Ziel = 1/6
    expect(r.stages[2].progress).toBeCloseTo(1 / 6);
  });

  it("sollte Etappe 4 (Sparquote) am 15-%-Ziel messen", () => {
    const r = computeFinanceFoundation({
      ...base,
      liquidBuffer: 6000, // 3 Monatsausgaben → Sicherheitspolster voll
      consumerDebt: 0,
      savingsRate: 0.075,
    });
    expect(r.currentKey).toBe("zukunft_besparen");
    expect(r.stages[3].progress).toBeCloseTo(0.5);
  });

  it("sollte den Gesamtfortschritt als Mittel der Etappen liefern", () => {
    const allDone = computeFinanceFoundation({
      liquidBuffer: 12000,
      monthlyExpenses: 2000,
      consumerDebt: 0,
      savingsRate: 0.3,
      goalsFunded: 1,
    });
    expect(allDone.overallProgress).toBeCloseTo(1);
    expect(allDone.currentKey).toBe("frei_grosszuegig");
    expect(allDone.stages.every((s) => s.status === "completed")).toBe(true);
  });

  describe("Edge Cases", () => {
    it("sollte mit Monatsausgaben 0 nicht durch Null teilen", () => {
      const r = computeFinanceFoundation({ ...base, monthlyExpenses: 0, liquidBuffer: 1000, consumerDebt: 0 });
      expect(r.stages[2].progress).toBe(1); // Puffer > 0, keine Ausgaben → als erfüllt gewertet
    });
  });
});
