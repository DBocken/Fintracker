import { describe, it, expect } from "vitest";
import {
  calculatePayoffPlan,
  getTotalDebt,
  getTotalMinPayment,
} from "./debt-service";
import type { Debt } from "../types";

function makeDebt(partial: Partial<Debt> & { id: string }): Debt {
  return {
    user_id: "test",
    name: partial.id,
    type: "other",
    balance: 0,
    interest_rate: 0,
    min_payment: 0,
    is_bnpl: false,
    is_paid_off: false,
    ...partial,
  } as Debt;
}

describe("getTotalDebt / getTotalMinPayment", () => {
  it("summiert nur offene Schulden und ignoriert negative Werte", () => {
    const debts = [
      makeDebt({ id: "a", balance: 1000, min_payment: 50 }),
      makeDebt({ id: "b", balance: 500, min_payment: 25 }),
      makeDebt({ id: "c", balance: 999, min_payment: 99, is_paid_off: true }),
      makeDebt({ id: "d", balance: -50, min_payment: -10 }),
    ];
    expect(getTotalDebt(debts)).toBe(1500);
    expect(getTotalMinPayment(debts)).toBe(75);
  });
});

describe("calculatePayoffPlan", () => {
  it("meldet unzureichendes Budget, wenn unter der Summe der Mindestraten", () => {
    const debts = [
      makeDebt({ id: "a", balance: 1000, min_payment: 100, interest_rate: 10 }),
      makeDebt({ id: "b", balance: 2000, min_payment: 150, interest_rate: 5 }),
    ];
    const plan = calculatePayoffPlan(debts, 200, "avalanche");
    expect(plan.insufficientBudget).toBe(true);
    expect(plan.totalMonths).toBe(0);
  });

  it("zahlt zinslose Schuld exakt nach Cent-Logik ab", () => {
    const debts = [makeDebt({ id: "a", balance: 1000, min_payment: 100, interest_rate: 0 })];
    const plan = calculatePayoffPlan(debts, 100, "snowball");
    expect(plan.insufficientBudget).toBe(false);
    expect(plan.totalMonths).toBe(10);
    expect(plan.totalInterestPaid).toBe(0);
  });

  it("priorisiert bei Avalanche die höchste Zinsrate zuerst", () => {
    const debts = [
      makeDebt({ id: "low-rate-big", balance: 5000, min_payment: 50, interest_rate: 3 }),
      makeDebt({ id: "high-rate-small", balance: 1000, min_payment: 50, interest_rate: 24 }),
    ];
    const plan = calculatePayoffPlan(debts, 400, "avalanche");
    const byOrder = [...plan.steps].sort((a, b) => a.priorityOrder - b.priorityOrder);
    expect(byOrder[0].name).toBe("high-rate-small");
  });

  it("priorisiert bei Snowball den kleinsten Saldo zuerst", () => {
    const debts = [
      makeDebt({ id: "big", balance: 5000, min_payment: 50, interest_rate: 24 }),
      makeDebt({ id: "small", balance: 1000, min_payment: 50, interest_rate: 3 }),
    ];
    const plan = calculatePayoffPlan(debts, 400, "snowball");
    const byOrder = [...plan.steps].sort((a, b) => a.priorityOrder - b.priorityOrder);
    expect(byOrder[0].name).toBe("small");
  });

  it("verursacht bei verzinster Schuld positive Zinskosten", () => {
    const debts = [makeDebt({ id: "a", balance: 1000, min_payment: 100, interest_rate: 12 })];
    const plan = calculatePayoffPlan(debts, 100, "avalanche");
    expect(plan.totalInterestPaid).toBeGreaterThan(0);
    // Mit 1 % Monatszins braucht 1000€ bei 100€/Monat länger als die zinslosen 10 Monate.
    expect(plan.totalMonths).toBeGreaterThan(10);
  });

  it("liefert für gar keine offenen Schulden einen leeren Plan", () => {
    const plan = calculatePayoffPlan([], 500, "avalanche");
    expect(plan.steps).toHaveLength(0);
    expect(plan.totalMonths).toBe(0);
    expect(plan.insufficientBudget).toBe(false);
  });
});
