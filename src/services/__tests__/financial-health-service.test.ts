import { describe, expect, it } from "vitest";
import { computeFinancialHealth, getHealthLabel } from "../financial-health-service";
import type { NetWorthBreakdown } from "../net-worth-service";
import type { Debt, Transaction } from "../../types";

const EMPTY_NET_WORTH: NetWorthBreakdown = {
  cash: 0,
  investments: 0,
  receivables: 0,
  debts: 0,
  netWorth: 0,
  accountBalances: {},
  accountSources: [],
  portfolioSources: [],
  debtSources: [],
  receivableSources: [],
};

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    date: new Date().toISOString().split("T")[0],
    amount: 0,
    payee: "",
    description: "",
    original_text: "",
    auto_mapped: false,
    confirmed: false,
    ...overrides,
  };
}

function debt(overrides: Partial<Debt>): Debt {
  return {
    id: overrides.id || "d1",
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

describe("computeFinancialHealth - edge cases", () => {
  it("handles a completely empty profile without NaN or out-of-range scores", () => {
    const result = computeFinancialHealth([], [], EMPTY_NET_WORTH);

    // No debt and no fixed costs contribute positively (25% + 15%) even
    // though emergency fund, savings rate and liquidity are all 0.
    expect(result.score).toBe(40);
    expect(result.monthlyIncome).toBe(0);
    expect(result.monthlyExpenses).toBe(0);
    expect(result.savingsRate).toBe(0);
    expect(result.subScores).toHaveLength(5);
    for (const sub of result.subScores) {
      expect(Number.isNaN(sub.score)).toBe(false);
      expect(sub.score).toBeGreaterThanOrEqual(0);
      expect(sub.score).toBeLessThanOrEqual(100);
    }
  });

  it("scores debt-free as a perfect 100 on the debt sub-score regardless of income", () => {
    const result = computeFinancialHealth([], [], EMPTY_NET_WORTH);
    const debtScore = result.subScores.find((s) => s.key === "debt")!;
    expect(debtScore.score).toBe(100);
  });

  it("never returns a score outside [0, 100] even with extreme inputs", () => {
    const transactions: Transaction[] = [
      tx({ amount: 10, date: new Date().toISOString().split("T")[0] }), // tiny income
    ];
    const netWorth: NetWorthBreakdown = {
      ...EMPTY_NET_WORTH,
      debts: 1_000_000, // huge debt vs tiny income
    };

    const result = computeFinancialHealth(transactions, [], netWorth);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    for (const sub of result.subScores) {
      expect(sub.score).toBeGreaterThanOrEqual(0);
      expect(sub.score).toBeLessThanOrEqual(100);
    }
  });
});

describe("computeFinancialHealth - savings rate", () => {
  it("computes a 20% savings rate as a perfect savings_rate sub-score", () => {
    const today = new Date().toISOString().split("T")[0];
    // 3 months of: income 1000, expenses 800 -> savings rate 20%
    const transactions: Transaction[] = [];
    for (let i = 0; i < 3; i++) {
      transactions.push(tx({ date: today, amount: 1000 }));
      transactions.push(tx({ date: today, amount: -800 }));
    }

    const result = computeFinancialHealth(transactions, [], EMPTY_NET_WORTH);

    expect(result.savingsRate).toBeCloseTo(0.2, 5);
    const savingsScore = result.subScores.find((s) => s.key === "savings_rate")!;
    expect(savingsScore.score).toBe(100);
  });

  it("clamps savings_rate score at 100 even when savings rate exceeds 20%", () => {
    const today = new Date().toISOString().split("T")[0];
    const transactions: Transaction[] = [
      tx({ date: today, amount: 1000 }),
      tx({ date: today, amount: -100 }), // 90% savings rate
    ];

    const result = computeFinancialHealth(transactions, [], EMPTY_NET_WORTH);
    const savingsScore = result.subScores.find((s) => s.key === "savings_rate")!;
    expect(savingsScore.score).toBe(100);
  });

  it("ignores transactions older than the 3-month window", () => {
    const old = new Date();
    old.setFullYear(old.getFullYear() - 1);
    const transactions: Transaction[] = [
      tx({ date: old.toISOString().split("T")[0], amount: 5000 }),
    ];

    const result = computeFinancialHealth(transactions, [], EMPTY_NET_WORTH);
    expect(result.monthlyIncome).toBe(0);
  });
});

describe("computeFinancialHealth - emergency fund", () => {
  it("rates 6+ months of expenses covered as a perfect emergency fund score", () => {
    const today = new Date().toISOString().split("T")[0];
    const transactions: Transaction[] = [
      tx({ date: today, amount: 1000 }),
      tx({ date: today, amount: -1000 }), // monthlyAverages over 3 months -> 1000/3 expenses
    ];
    const netWorth: NetWorthBreakdown = { ...EMPTY_NET_WORTH, cash: 10000, netWorth: 10000 };

    const result = computeFinancialHealth(transactions, [], netWorth);
    const emergencyScore = result.subScores.find((s) => s.key === "emergency_fund")!;
    expect(emergencyScore.score).toBe(100);
  });

  it("treats positive cash with zero expenses as a fully-covered emergency fund", () => {
    const netWorth: NetWorthBreakdown = { ...EMPTY_NET_WORTH, cash: 5000, netWorth: 5000 };
    const result = computeFinancialHealth([], [], netWorth);
    const emergencyScore = result.subScores.find((s) => s.key === "emergency_fund")!;
    expect(emergencyScore.score).toBe(100);
  });
});

describe("computeFinancialHealth - liquidity & contracts", () => {
  it("scores liquidity below 50 when obligations exceed income", () => {
    const today = new Date().toISOString().split("T")[0];
    const transactions: Transaction[] = [
      tx({ date: today, amount: 1000 }),
      tx({ date: today, amount: -1500 }),
    ];
    const debts = [debt({ min_payment: 0 })];

    const result = computeFinancialHealth(transactions, debts, EMPTY_NET_WORTH);
    const liquidityScore = result.subScores.find((s) => s.key === "liquidity")!;
    expect(liquidityScore.score).toBeLessThan(50);
  });

  it("reduces the contracts score as fixed debt payments grow relative to income", () => {
    const today = new Date().toISOString().split("T")[0];
    const transactions: Transaction[] = [tx({ date: today, amount: 3000 })];

    const lightLoad = computeFinancialHealth(
      transactions,
      [debt({ min_payment: 100 })],
      EMPTY_NET_WORTH,
    );
    const heavyLoad = computeFinancialHealth(
      transactions,
      [debt({ min_payment: 1000 })],
      EMPTY_NET_WORTH,
    );

    const lightScore = lightLoad.subScores.find((s) => s.key === "contracts")!.score;
    const heavyScore = heavyLoad.subScores.find((s) => s.key === "contracts")!.score;
    expect(heavyScore).toBeLessThan(lightScore);
  });
});

describe("computeFinancialHealth - overall weighting", () => {
  it("weights sub-scores according to WEIGHTS and matches a manual calculation", () => {
    const today = new Date().toISOString().split("T")[0];
    // income 1200/mo, expenses 1000/mo -> savings rate ~16.7%
    const transactions: Transaction[] = [
      tx({ date: today, amount: 1200 }),
      tx({ date: today, amount: -1000 }),
    ];
    const netWorth: NetWorthBreakdown = { ...EMPTY_NET_WORTH, cash: 6000, netWorth: 6000 };
    const debts = [debt({ min_payment: 100 })];

    const result = computeFinancialHealth(transactions, debts, netWorth);

    const weights: Record<string, number> = {
      emergency_fund: 0.25,
      debt: 0.25,
      savings_rate: 0.2,
      liquidity: 0.15,
      contracts: 0.15,
    };
    const expected = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          result.subScores.reduce((sum, s) => sum + s.score * (weights[s.key] || 0), 0),
        ),
      ),
    );

    expect(result.score).toBe(expected);
  });
});

describe("getHealthLabel", () => {
  it("maps score ranges to the correct label/tone", () => {
    expect(getHealthLabel(90)).toEqual({ label: "Sehr gesund", tone: "good" });
    expect(getHealthLabel(80)).toEqual({ label: "Sehr gesund", tone: "good" });
    expect(getHealthLabel(79)).toEqual({ label: "Gesund", tone: "ok" });
    expect(getHealthLabel(60)).toEqual({ label: "Gesund", tone: "ok" });
    expect(getHealthLabel(59)).toEqual({ label: "Achtsam sein", tone: "warn" });
    expect(getHealthLabel(40)).toEqual({ label: "Achtsam sein", tone: "warn" });
    expect(getHealthLabel(39)).toEqual({ label: "Handlungsbedarf", tone: "bad" });
    expect(getHealthLabel(0)).toEqual({ label: "Handlungsbedarf", tone: "bad" });
  });
});
