import { describe, expect, it } from "vitest";
import { totalMinimumPayment, totalOutstandingDebt } from "../debt-totals";
import type { Debt } from "@/types";

/**
 * Summen über Schuldenstände. Lagen zuvor als `getTotalDebt`/`getTotalMinPayment`
 * im I/O-Service und summierten roh über Float-Euro — entgegen AGENTS.md §8
 * („Beträge intern immer Integer-Cent über src/lib/money.ts").
 */
function makeDebt(overrides: Partial<Debt>): Debt {
  return {
    id: overrides.id || "debt",
    user_id: "local",
    name: "Schuld",
    type: "other",
    balance: 0,
    interest_rate: 0,
    min_payment: 0,
    is_bnpl: false,
    is_paid_off: false,
    ...overrides,
  };
}

describe("totalOutstandingDebt / totalMinimumPayment", () => {
  it("sollte Stände und Mindestraten summieren und abbezahlte Schulden auslassen", () => {
    const debts = [
      makeDebt({ id: "a", balance: 1000, min_payment: 50 }),
      makeDebt({ id: "b", balance: 500, min_payment: 25 }),
      makeDebt({ id: "c", balance: 9999, min_payment: 999, is_paid_off: true }),
    ];

    expect(totalOutstandingDebt(debts)).toBe(1500);
    expect(totalMinimumPayment(debts)).toBe(75);
  });

  it("sollte negative Stände und Raten als 0 werten", () => {
    const debts = [makeDebt({ id: "a", balance: -100, min_payment: -10 })];
    expect(totalOutstandingDebt(debts)).toBe(0);
    expect(totalMinimumPayment(debts)).toBe(0);
  });

  it("sollte eine leere Liste als 0 summieren", () => {
    expect(totalOutstandingDebt([])).toBe(0);
    expect(totalMinimumPayment([])).toBe(0);
  });

  it("[REGRESSION] sollte centgenau summieren statt Float-Drift anzuhäufen", () => {
    // Die frühere Fassung summierte roh über Float-Euro. `toBeCloseTo` im alten
    // Test hat das gedeckt: 0.1 + 0.2 ergibt dort 0.30000000000000004, und
    // „ungefähr 0,30" gilt als bestanden. Auf einem Bildschirm, der Beträge auf
    // den Cent zeigt, ist „ungefähr" aber keine Aussage über Geld.
    const debts = [
      makeDebt({ id: "a", balance: 0.1, min_payment: 0.1 }),
      makeDebt({ id: "b", balance: 0.2, min_payment: 0.2 }),
    ];
    expect(totalOutstandingDebt(debts)).toBe(0.3);
    expect(totalMinimumPayment(debts)).toBe(0.3);
  });

  it("[REGRESSION] sollte auch über viele krumme Beträge exakt bleiben", () => {
    const debts = Array.from({ length: 30 }, (_, i) =>
      makeDebt({ id: `d${i}`, balance: 19.99, min_payment: 0.07 }),
    );
    expect(totalOutstandingDebt(debts)).toBe(599.7);
    expect(totalMinimumPayment(debts)).toBe(2.1);
  });
});
