import { describe, expect, it, vi } from "vitest";
import type { Transaction, Debt } from "../../types";

const mockTransactions: Transaction[] = [];
const mockDebts: Debt[] = [];

vi.mock("../transaction-service", () => ({
  getTransactions: vi.fn(() => Promise.resolve(mockTransactions)),
}));

vi.mock("../debt-service", async () => {
  const actual = await vi.importActual<typeof import("../debt-service")>("../debt-service");
  return {
    ...actual,
    getDebts: vi.fn(() => Promise.resolve(mockDebts)),
  };
});

import { detectPotentialDebts } from "../debt-detection-service";

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    date: "2024-01-15",
    amount: -10,
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

describe("detectPotentialDebts", () => {
  it("returns no suggestions when transactions are empty", async () => {
    mockTransactions.length = 0;
    mockDebts.length = 0;

    expect(await detectPotentialDebts()).toEqual([]);
  });

  it("detects dunning/inkasso patterns", async () => {
    mockTransactions.length = 0;
    mockDebts.length = 0;
    mockTransactions.push(
      tx({ payee: "Inkasso Müller GmbH", description: "Mahnung Forderung", amount: -50 }),
      tx({ payee: "Inkasso Müller GmbH", description: "Mahnung Forderung", amount: -55 })
    );

    const suggestions = await detectPotentialDebts();
    const dunning = suggestions.find((s) => s.kind === "dunning");

    expect(dunning).toBeDefined();
    expect(dunning?.occurrences).toBe(2);
    expect(dunning?.suggestedType).toBe("other");
    expect(dunning?.totalAmount).toBeCloseTo(105);
  });

  it("detects recurring BNPL debits with 3 or more occurrences", async () => {
    mockTransactions.length = 0;
    mockDebts.length = 0;
    mockTransactions.push(
      tx({ payee: "Klarna Ratenzahlung", amount: -30 }),
      tx({ payee: "Klarna Ratenzahlung", amount: -30 }),
      tx({ payee: "Klarna Ratenzahlung", amount: -30 })
    );

    const suggestions = await detectPotentialDebts();
    const bnpl = suggestions.find((s) => s.kind === "bnpl_recurring");

    expect(bnpl).toBeDefined();
    expect(bnpl?.occurrences).toBe(3);
    expect(bnpl?.suggestedType).toBe("bnpl");
  });

  it("does not suggest BNPL when there are fewer than 3 occurrences", async () => {
    mockTransactions.length = 0;
    mockDebts.length = 0;
    mockTransactions.push(
      tx({ payee: "Klarna Ratenzahlung", amount: -30 }),
      tx({ payee: "Klarna Ratenzahlung", amount: -30 })
    );

    const suggestions = await detectPotentialDebts();
    expect(suggestions.find((s) => s.kind === "bnpl_recurring")).toBeUndefined();
  });

  it("detects overdraft/Dispo interest charges", async () => {
    mockTransactions.length = 0;
    mockDebts.length = 0;
    mockTransactions.push(tx({ payee: "Sparkasse", description: "Überziehungszinsen Konto", amount: -12 }));

    const suggestions = await detectPotentialDebts();
    const overdraft = suggestions.find((s) => s.kind === "overdraft_fee");

    expect(overdraft).toBeDefined();
    expect(overdraft?.suggestedType).toBe("overdraft");
  });

  it("filters out suggestions that match an existing debt", async () => {
    mockTransactions.length = 0;
    mockDebts.length = 0;
    mockTransactions.push(
      tx({ payee: "Klarna Ratenzahlung", amount: -30 }),
      tx({ payee: "Klarna Ratenzahlung", amount: -30 }),
      tx({ payee: "Klarna Ratenzahlung", amount: -30 })
    );
    mockDebts.push(debt({ name: "Klarna Ratenzahlung", type: "bnpl" }));

    const suggestions = await detectPotentialDebts();
    expect(suggestions.find((s) => s.kind === "bnpl_recurring")).toBeUndefined();
  });

  it("ignores positive amounts (no debt patterns from income)", async () => {
    mockTransactions.length = 0;
    mockDebts.length = 0;
    mockTransactions.push(tx({ payee: "Inkasso Müller GmbH", description: "Mahnung Erstattung", amount: 50 }));

    const suggestions = await detectPotentialDebts();
    expect(suggestions).toEqual([]);
  });
});
