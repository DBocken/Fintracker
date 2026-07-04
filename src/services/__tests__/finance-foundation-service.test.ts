import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Debt, Transaction } from "../../types";
import type { NetWorthBreakdown } from "../net-worth-service";
import type { FinancialHealth } from "../financial-health-service";

vi.mock("../financial-health-service", () => ({
  getFinancialHealth: vi.fn(),
}));

vi.mock("../debt-service", () => ({
  getDebts: vi.fn(),
}));

vi.mock("../transaction-service", () => ({
  getTransactions: vi.fn(),
  getCategories: vi.fn(),
}));

import { getFinanceFoundation } from "../finance-foundation-service";
import { getFinancialHealth } from "../financial-health-service";
import { getDebts } from "../debt-service";
import { getTransactions } from "../transaction-service";

// Fester Stichtag (15.06.2026) → deterministisches 6-Monats-Fenster 2026-01…2026-06.
const REFERENCE = new Date(2026, 5, 15);

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
    date: "2026-06-01",
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

function setup({
  cash = 0,
  savingsRate = 0,
  debts = [],
  transactions = [],
}: {
  cash?: number;
  savingsRate?: number;
  debts?: Debt[];
  transactions?: Transaction[];
}) {
  const health: FinancialHealth = {
    score: 50,
    subScores: [],
    netWorth: { ...EMPTY_NET_WORTH, cash, netWorth: cash },
    monthlyIncome: 0,
    monthlyExpenses: 0,
    savingsRate,
  };
  vi.mocked(getFinancialHealth).mockResolvedValue(health);
  vi.mocked(getDebts).mockResolvedValue(debts);
  vi.mocked(getTransactions).mockResolvedValue(transactions);
}

/** Fortschritt der Sicherheitspolster-Etappe = liquidBuffer / Monatsausgaben / 3. */
async function bufferStageProgress(): Promise<number> {
  const result = await getFinanceFoundation(REFERENCE);
  return result.stages.find((s) => s.key === "sicherheitspolster")!.progress;
}

describe("getFinanceFoundation (Median-Monatsausgaben & Konsumschulden)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Normal Behavior – Median der Monatsausgaben", () => {
    it("sollte den Median über die Monatsausgaben des 6-Monats-Fensters bilden", async () => {
      // Drei Monate mit 1000/2000/3000 € Ausgaben → Median 2000 €.
      setup({
        cash: 3000,
        transactions: [
          tx({ date: "2026-06-05", amount: -1000 }),
          tx({ date: "2026-05-05", amount: -2000 }),
          tx({ date: "2026-04-05", amount: -3000 }),
        ],
      });
      // 3000 € Puffer / 2000 € Median / 3 Zielmonate = 0,5.
      expect(await bufferStageProgress()).toBeCloseTo(0.5, 5);
    });

    it("sollte mehrere Buchungen desselben Monats zu einer Monatssumme addieren", async () => {
      setup({
        cash: 3000,
        transactions: [
          tx({ date: "2026-06-05", amount: -400 }),
          tx({ date: "2026-06-20", amount: -600 }), // Juni gesamt: 1000 €
          tx({ date: "2026-05-05", amount: -2000 }),
        ],
      });
      // Median aus [1000, 2000] = 1500 → 3000/1500/3 ≈ 0,667.
      expect(await bufferStageProgress()).toBeCloseTo(3000 / 1500 / 3, 5);
    });

    it("sollte Transfers und Einnahmen aus den Monatsausgaben ausschließen", async () => {
      setup({
        cash: 1500,
        transactions: [
          tx({ date: "2026-06-05", amount: -1000 }),
          tx({ date: "2026-06-06", amount: -500, is_transfer: true }), // Umbuchung
          tx({ date: "2026-06-07", amount: 3000 }), // Gehalt
        ],
      });
      // Nur die 1000 € zählen → 1500/1000/3 = 0,5.
      expect(await bufferStageProgress()).toBeCloseTo(0.5, 5);
    });

    it("sollte Buchungen außerhalb des 6-Monats-Fensters ignorieren", async () => {
      setup({
        cash: 1500,
        transactions: [
          tx({ date: "2025-12-15", amount: -9000 }), // ein Monat vor dem Fenster
          tx({ date: "2026-06-05", amount: -1000 }),
        ],
      });
      // Der Ausreißer-Monat 2025-12 liegt außerhalb → Median bleibt 1000 €.
      expect(await bufferStageProgress()).toBeCloseTo(0.5, 5);
    });
  });

  describe("Normal Behavior – Konsumschulden-Filter", () => {
    it("sollte Immobilienkredite (mortgage) nicht als Konsumschulden werten", async () => {
      setup({ debts: [debt({ type: "mortgage", balance: 250000 })] });
      const result = await getFinanceFoundation(REFERENCE);
      const stage = result.stages.find((s) => s.key === "teure_schulden")!;
      expect(stage.progress).toBe(1);
      expect(stage.status).toBe("completed");
    });

    it("sollte offene Konsumschulden als aktive Etappe erkennen", async () => {
      setup({
        cash: 2000, // Starthilfe (1000 €) abgeschlossen → Schulden-Etappe aktiv.
        debts: [debt({ type: "credit_card", balance: 800 })],
      });
      const result = await getFinanceFoundation(REFERENCE);
      expect(result.currentKey).toBe("teure_schulden");
      const stage = result.stages.find((s) => s.key === "teure_schulden")!;
      expect(stage.progress).toBe(0);
    });

    it("sollte abbezahlte Schulden und negative Salden nicht mitzählen", async () => {
      setup({
        debts: [
          debt({ id: "alt", type: "credit_card", balance: 500, is_paid_off: true }),
          debt({ id: "guthaben", type: "credit_card", balance: -50 }),
        ],
      });
      const result = await getFinanceFoundation(REFERENCE);
      expect(result.stages.find((s) => s.key === "teure_schulden")!.progress).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    it("sollte ohne erfasste Ausgaben das Polster über den reinen Puffer bewerten", async () => {
      setup({ cash: 500 });
      // monthlyExpenses = 0 → Sicherheitspolster gilt mit positivem Puffer als erfüllt.
      expect(await bufferStageProgress()).toBe(1);
    });

    it("sollte mit komplett leeren Daten in der Starthilfe mit Fortschritt 0 starten", async () => {
      setup({});
      const result = await getFinanceFoundation(REFERENCE);
      expect(result.currentKey).toBe("starthilfe");
      expect(result.stages.find((s) => s.key === "starthilfe")!.progress).toBe(0);
      expect(Number.isNaN(result.overallProgress)).toBe(false);
    });

    it("sollte negatives Cash-Vermögen auf einen Puffer von 0 klemmen", async () => {
      setup({ cash: -300 });
      const result = await getFinanceFoundation(REFERENCE);
      expect(result.stages.find((s) => s.key === "starthilfe")!.progress).toBe(0);
    });
  });
});
