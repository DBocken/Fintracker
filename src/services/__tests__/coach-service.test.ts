import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Category, Debt, Transaction } from "../../types";
import type { NetWorthBreakdown } from "../net-worth-service";
import type { FinancialHealth } from "../financial-health-service";

vi.mock("../transaction-service", () => ({
  getTransactions: vi.fn(),
  getCategories: vi.fn(),
}));

// Nur die Datenbeschaffung mocken – die reine Payoff-Mathematik
// (getTotalDebt/getTotalMinPayment/calculatePayoffPlan) bleibt echt,
// damit der Test Verhalten statt Implementierung prüft.
vi.mock("../debt-service", async () => {
  const actual = await vi.importActual<typeof import("../debt-service")>("../debt-service");
  return { ...actual, getDebts: vi.fn() };
});

vi.mock("../financial-health-service", async () => {
  const actual = await vi.importActual<typeof import("../financial-health-service")>(
    "../financial-health-service",
  );
  return { ...actual, getFinancialHealth: vi.fn() };
});

import { getCoachOverview } from "../coach-service";
import { getCategories, getTransactions } from "../transaction-service";
import { getDebts } from "../debt-service";
import { getFinancialHealth } from "../financial-health-service";

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

interface Scenario {
  /** Durchschnittliche Monats-Einnahmen (über monthlyAverages, Fenster 3 Monate). */
  monthlyIncome?: number;
  /** Durchschnittliche Monats-Ausgaben. */
  monthlyExpenses?: number;
  /** Liquiditätsreserve (health.netWorth.cash). */
  cash?: number;
  debts?: Debt[];
  categories?: Category[];
  savingsRate?: number;
}

function setup({
  monthlyIncome = 0,
  monthlyExpenses = 0,
  cash = 0,
  debts = [],
  categories = [],
  savingsRate = 0.2,
}: Scenario) {
  // monthlyAverages teilt die Summe des 3-Monats-Fensters durch 3 –
  // eine einzelne Buchung mit dem 3-fachen Betrag ergibt exakt den Monatswert.
  const transactions: Transaction[] = [];
  if (monthlyIncome > 0) transactions.push(tx({ amount: monthlyIncome * 3 }));
  if (monthlyExpenses > 0) transactions.push(tx({ amount: -monthlyExpenses * 3 }));

  const health: FinancialHealth = {
    score: 50,
    subScores: [],
    netWorth: { ...EMPTY_NET_WORTH, cash, netWorth: cash },
    monthlyIncome,
    monthlyExpenses,
    savingsRate,
  };

  vi.mocked(getTransactions).mockResolvedValue(transactions);
  vi.mocked(getCategories).mockResolvedValue(categories);
  vi.mocked(getDebts).mockResolvedValue(debts);
  vi.mocked(getFinancialHealth).mockResolvedValue(health);
}

describe("getCoachOverview (Roadmap-Stufen & Schulden-Coach)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Normal Behavior – Stage-Übergänge", () => {
    it("sollte starter_emergency_fund wählen, wenn der Puffer unter 1 Monat liegt", async () => {
      setup({ monthlyIncome: 2000, monthlyExpenses: 1000, cash: 500 });
      const overview = await getCoachOverview();
      expect(overview.stage.key).toBe("starter_emergency_fund");
      expect(overview.recommendations[0].id).toBe("build-starter-fund");
    });

    it("sollte consumer_debt_elimination wählen, wenn Puffer ≥ 1 Monat und Schulden offen sind", async () => {
      setup({
        monthlyIncome: 2000,
        monthlyExpenses: 1000,
        cash: 2000,
        debts: [debt({ balance: 500, min_payment: 50 })],
      });
      const overview = await getCoachOverview();
      expect(overview.stage.key).toBe("consumer_debt_elimination");
    });

    it("sollte full_emergency_fund wählen, wenn schuldenfrei aber Puffer unter 3 Monaten", async () => {
      setup({ monthlyIncome: 2000, monthlyExpenses: 1000, cash: 2000 });
      const overview = await getCoachOverview();
      expect(overview.stage.key).toBe("full_emergency_fund");
    });

    it("sollte personal_goals wählen, wenn schuldenfrei und Puffer ≥ 3 Monate", async () => {
      setup({ monthlyIncome: 2000, monthlyExpenses: 1000, cash: 4000 });
      const overview = await getCoachOverview();
      expect(overview.stage.key).toBe("personal_goals");
      expect(overview.recommendations[0].id).toBe("fund-goals");
    });

    it("sollte abbezahlte Schulden nicht als offene Schuldenlast werten", async () => {
      setup({
        monthlyIncome: 2000,
        monthlyExpenses: 1000,
        cash: 4000,
        debts: [debt({ balance: 500, is_paid_off: true })],
      });
      const overview = await getCoachOverview();
      expect(overview.stage.key).toBe("personal_goals");
      expect(overview.debtSummary.totalDebt).toBe(0);
    });
  });

  describe("Normal Behavior – Stage-Fortschritt & Status", () => {
    it("sollte den Starter-Fortschritt als Puffer-Monate (max 1) berechnen", async () => {
      // 500 € Reserve bei 1000 € Monatsausgaben = 0,5 Monate Puffer.
      setup({ monthlyIncome: 2000, monthlyExpenses: 1000, cash: 500 });
      const overview = await getCoachOverview();
      expect(overview.stage.progress).toBeCloseTo(0.5, 5);
      expect(overview.stage.status).toBe("active");
    });

    it("sollte den Fortschritt des vollen Notgroschens auf 3 Monate normieren", async () => {
      // 1,5 Monate Puffer bei Ziel 3 Monate → 50 % Fortschritt.
      setup({ monthlyIncome: 2000, monthlyExpenses: 1000, cash: 1500 });
      const overview = await getCoachOverview();
      expect(overview.stage.key).toBe("full_emergency_fund");
      expect(overview.stage.progress).toBeCloseTo(0.5, 5);
      expect(overview.stage.status).toBe("active");
    });

    it("sollte die Schuldenabbau-Stufe bei offenen Schulden als aktiv mit Teilfortschritt zeigen", async () => {
      setup({
        monthlyIncome: 2000,
        monthlyExpenses: 1000,
        cash: 2000,
        debts: [debt({ balance: 500, min_payment: 50 })],
      });
      const overview = await getCoachOverview();
      expect(overview.stage.progress).toBeLessThan(1);
      expect(overview.stage.status).toBe("active");
    });
  });

  describe("Normal Behavior – Schulden-Empfehlungen", () => {
    it("sollte existenzsichernde Rückstände vor der Strategie-Empfehlung priorisieren", async () => {
      setup({
        monthlyIncome: 2000,
        monthlyExpenses: 1000,
        cash: 2000,
        debts: [
          debt({ id: "kk", name: "Kreditkarte", balance: 800, min_payment: 50 }),
          debt({
            id: "miete",
            name: "Mietrückstand",
            balance: 400,
            min_payment: 100,
            priority: "existenzsichernd",
          }),
        ],
      });
      const overview = await getCoachOverview();
      const ids = overview.recommendations.map((r) => r.id);
      expect(ids.indexOf("secure-essentials-first")).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf("secure-essentials-first")).toBeLessThan(ids.indexOf("pay-down-debt"));
      expect(overview.recommendations[0].message).toContain("Mietrückstand");
    });

    it("sollte totalDebt und Mindestraten korrekt in der debtSummary aggregieren", async () => {
      setup({
        monthlyIncome: 3000,
        monthlyExpenses: 1000,
        cash: 2000,
        debts: [
          debt({ id: "a", balance: 1000, min_payment: 100 }),
          debt({ id: "b", balance: 500, min_payment: 25 }),
        ],
      });
      const overview = await getCoachOverview();
      expect(overview.debtSummary.totalDebt).toBe(1500);
      expect(overview.debtSummary.minimumMonthlyBurden).toBe(125);
      expect(overview.debtSummary.snowballMonths).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("sollte bei monthlyExpenses = 0 und Cash-Reserve > 0 den Puffer als 6 Monate werten", async () => {
      // Keine Ausgaben erfasst, aber Reserve vorhanden → 6 Monate Puffer
      // → schuldenfrei direkt in personal_goals statt fälschlich im Starter.
      setup({ cash: 5000 });
      const overview = await getCoachOverview();
      expect(overview.stage.key).toBe("personal_goals");
    });

    it("sollte bei monthlyExpenses = 0 und Cash-Reserve = 0 den Puffer als 0 werten", async () => {
      setup({ cash: 0 });
      const overview = await getCoachOverview();
      expect(overview.stage.key).toBe("starter_emergency_fund");
      expect(overview.stage.progress).toBe(0);
    });

    it("sollte bei negativem freien Cashflow das Tilgungsbudget auf die Mindestraten klemmen (disposable ≥ 0)", async () => {
      // Ausgaben + Mindestrate übersteigen das Einkommen: disposable wird auf 0
      // geklemmt, das Budget bleibt bei den Mindestraten → Plan bleibt rechenbar.
      setup({
        monthlyIncome: 1000,
        monthlyExpenses: 2000,
        cash: 2000,
        debts: [debt({ balance: 1000, min_payment: 100, interest_rate: 0 })],
      });
      const overview = await getCoachOverview();
      expect(overview.stage.key).toBe("consumer_debt_elimination");
      // 1000 € Schulden / 100 € Mindestrate bei 0 % Zins = 10 Monate.
      expect(overview.debtSummary.snowballMonths).toBe(10);
      const payDown = overview.recommendations.find((r) => r.id === "pay-down-debt");
      expect(payDown?.message).not.toContain("nicht einmal für alle Mindestraten");
    });

    it("sollte mit komplett leeren Daten stabil bleiben (keine NaN, Starter-Stufe)", async () => {
      setup({});
      const overview = await getCoachOverview();
      expect(overview.stage.key).toBe("starter_emergency_fund");
      expect(Number.isNaN(overview.stage.progress)).toBe(false);
      expect(overview.debtSummary.totalDebt).toBe(0);
      expect(overview.debtSummary.snowballMonths).toBe(0);
      expect(overview.categoryGuidance).toEqual([]);
    });

    it("sollte Vertragskategorien als geschützt mit Kündigungs-Hinweis ausweisen", async () => {
      const contractCategory: Category = {
        id: "cat-abo",
        name: "Streaming",
        filters: [],
        attributes: { ist_vertrag: true },
      };
      setup({ monthlyIncome: 2000, monthlyExpenses: 1000, cash: 500, categories: [contractCategory] });
      const overview = await getCoachOverview();
      expect(overview.categoryGuidance).toHaveLength(1);
      expect(overview.categoryGuidance[0].status).toBe("protected");
      expect(overview.categoryGuidance[0].reason).toContain("Vertrag");
    });

    it("sollte bei niedriger Sparquote einen warnenden Insight liefern", async () => {
      setup({ monthlyIncome: 2000, monthlyExpenses: 1000, cash: 500, savingsRate: 0.05 });
      const overview = await getCoachOverview();
      const insight = overview.insights.find((i) => i.id === "spending-pattern");
      expect(insight?.severity).toBe("warning");
    });
  });
});
