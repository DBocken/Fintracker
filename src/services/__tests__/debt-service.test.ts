import { describe, expect, it } from "vitest";
import { calculatePayoffPlan, getTotalDebt, getTotalMinPayment } from "../debt-service";
import type { Debt } from "../../types";

function makeDebt(overrides: Partial<Debt>): Debt {
  return {
    id: overrides.id || crypto.randomUUID(),
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

describe("getTotalDebt / getTotalMinPayment", () => {
  it("sums balances and min payments, ignoring paid-off debts", () => {
    const debts = [
      makeDebt({ id: "a", balance: 1000, min_payment: 50 }),
      makeDebt({ id: "b", balance: 500, min_payment: 25 }),
      makeDebt({ id: "c", balance: 9999, min_payment: 999, is_paid_off: true }),
    ];

    expect(getTotalDebt(debts)).toBeCloseTo(1500);
    expect(getTotalMinPayment(debts)).toBeCloseTo(75);
  });

  it("ignores negative balances/min payments", () => {
    const debts = [makeDebt({ id: "a", balance: -100, min_payment: -10 })];
    expect(getTotalDebt(debts)).toBe(0);
    expect(getTotalMinPayment(debts)).toBe(0);
  });
});

describe("calculatePayoffPlan", () => {
  it("returns an empty plan for no active debts", () => {
    const plan = calculatePayoffPlan([], 100, "avalanche");
    expect(plan).toEqual({
      strategy: "avalanche",
      steps: [],
      totalMonths: 0,
      totalInterestPaid: 0,
      insufficientBudget: false,
    });
  });

  it("flags insufficientBudget when the budget is below the sum of min payments", () => {
    const debts = [
      makeDebt({ id: "a", balance: 1000, min_payment: 100, interest_rate: 10 }),
      makeDebt({ id: "b", balance: 1000, min_payment: 100, interest_rate: 5 }),
    ];

    const plan = calculatePayoffPlan(debts, 150, "avalanche");

    expect(plan.insufficientBudget).toBe(true);
    expect(plan.totalMonths).toBe(0);
    expect(plan.totalInterestPaid).toBe(0);
    expect(plan.steps).toHaveLength(2);
    // Steps still report initial balances/rates for display purposes.
    expect(plan.steps.find((s) => s.debtId === "a")?.balance).toBe(1000);
  });

  it("avalanche prioritizes the highest interest rate first", () => {
    const debts = [
      makeDebt({ id: "low-rate", balance: 1000, min_payment: 50, interest_rate: 5 }),
      makeDebt({ id: "high-rate", balance: 1000, min_payment: 50, interest_rate: 20 }),
    ];

    const plan = calculatePayoffPlan(debts, 200, "avalanche");

    const highRate = plan.steps.find((s) => s.debtId === "high-rate")!;
    const lowRate = plan.steps.find((s) => s.debtId === "low-rate")!;

    expect(highRate.priorityOrder).toBe(1);
    expect(lowRate.priorityOrder).toBe(2);
    // Extra budget goes to the high-rate debt first, so it pays off sooner.
    expect(highRate.monthsToPayoff).toBeLessThan(lowRate.monthsToPayoff);
  });

  it("snowball prioritizes the smallest balance first", () => {
    const debts = [
      makeDebt({ id: "big", balance: 5000, min_payment: 50, interest_rate: 10 }),
      makeDebt({ id: "small", balance: 500, min_payment: 50, interest_rate: 10 }),
    ];

    const plan = calculatePayoffPlan(debts, 300, "snowball");

    const small = plan.steps.find((s) => s.debtId === "small")!;
    const big = plan.steps.find((s) => s.debtId === "big")!;

    expect(small.priorityOrder).toBe(1);
    expect(big.priorityOrder).toBe(2);
    expect(small.monthsToPayoff).toBeLessThan(big.monthsToPayoff);
  });

  it("accrues monthly interest before applying payments", () => {
    // Single debt, budget exactly covers the min payment with no extra.
    // After month 1: balance = 1000 * (1 + 0.12/12) - 100 = 1000*1.01 - 100 = 910
    const debts = [makeDebt({ id: "a", balance: 1000, min_payment: 100, interest_rate: 12 })];

    const plan = calculatePayoffPlan(debts, 100, "avalanche");

    expect(plan.insufficientBudget).toBe(false);
    expect(plan.totalInterestPaid).toBeGreaterThan(0);
    // 9 full payments of 100 wouldn't clear 1000 without interest, but
    // interest pushes the final balance just over, requiring 11 months.
    expect(plan.totalMonths).toBeGreaterThanOrEqual(10);
  });

  it("a larger monthly budget shortens the time to debt-free and changes total interest", () => {
    const debts = [
      makeDebt({ id: "a", balance: 2000, min_payment: 50, interest_rate: 15 }),
      makeDebt({ id: "b", balance: 1000, min_payment: 30, interest_rate: 8 }),
    ];

    const tightPlan = calculatePayoffPlan(debts, 80, "avalanche");
    const generousPlan = calculatePayoffPlan(debts, 300, "avalanche");

    expect(generousPlan.totalMonths).toBeLessThan(tightPlan.totalMonths);
    expect(generousPlan.totalInterestPaid).toBeLessThan(tightPlan.totalInterestPaid);
  });

  it("never runs longer than 600 months (50 years) even with insufficient extra budget", () => {
    const debts = [makeDebt({ id: "a", balance: 1_000_000, min_payment: 1, interest_rate: 20 })];
    const plan = calculatePayoffPlan(debts, 1, "avalanche");
    expect(plan.totalMonths).toBeLessThanOrEqual(600);
  });
});
