import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Transaction } from "../../types";

const mockTransactions: Transaction[] = [];

vi.mock("../transaction-service", () => ({
  getTransactions: vi.fn(() => Promise.resolve(mockTransactions)),
}));

import { detectRecurringTransactions } from "../contract-detection-service";

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    date: "2026-01-15",
    amount: -10,
    payee: "Test",
    description: "",
    original_text: "",
    auto_mapped: false,
    confirmed: false,
    is_transfer: false,
    account_id: "acc-1",
    ...overrides,
  };
}

describe("detectRecurringTransactions", () => {
  beforeEach(() => {
    mockTransactions.length = 0;
  });

  it("returns empty array when no transactions exist", async () => {
    const result = await detectRecurringTransactions();
    expect(result).toEqual([]);
  });

  it("ignores transactions with fewer than 3 occurrences", async () => {
    mockTransactions.push(
      tx({ payee: "Netflix", date: "2026-01-01", amount: -9.99 }),
      tx({ payee: "Netflix", date: "2026-02-01", amount: -9.99 })
    );
    const result = await detectRecurringTransactions();
    expect(result).toEqual([]);
  });

  it("detects monthly recurring transactions", async () => {
    mockTransactions.push(
      tx({ payee: "Netflix", date: "2026-01-01", amount: -9.99 }),
      tx({ payee: "Netflix", date: "2026-02-01", amount: -9.99 }),
      tx({ payee: "Netflix", date: "2026-03-01", amount: -9.99 })
    );
    const result = await detectRecurringTransactions();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      payee: "Netflix",
      amountTypical: 9.99,
      cycle: "Monatlich",
      type: "Ausgabe",
    });
  });

  it("detects weekly recurring transactions", async () => {
    mockTransactions.push(
      tx({ payee: "Gym", date: "2026-01-06", amount: -15.0 }),
      tx({ payee: "Gym", date: "2026-01-13", amount: -15.0 }),
      tx({ payee: "Gym", date: "2026-01-20", amount: -15.0 })
    );
    const result = await detectRecurringTransactions();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      cycle: "Wöchentlich",
    });
  });

  it("detects price increases", async () => {
    mockTransactions.push(
      tx({ payee: "Internet", date: "2026-01-01", amount: -49.99 }),
      tx({ payee: "Internet", date: "2026-02-01", amount: -49.99 }),
      tx({ payee: "Internet", date: "2026-03-01", amount: -49.99 }),
      tx({ payee: "Internet", date: "2026-04-01", amount: -59.99 })
    );
    const result = await detectRecurringTransactions();
    const lastWithChange = result.find((c) => c.changed);
    expect(lastWithChange).toBeDefined();
    expect(lastWithChange?.changeAmount).toBeCloseTo(10.0, 1);
  });

  it("ignores transfer transactions", async () => {
    mockTransactions.push(
      tx({ payee: "Transfer", date: "2026-01-01", amount: -100, is_transfer: true }),
      tx({ payee: "Transfer", date: "2026-02-01", amount: -100, is_transfer: true }),
      tx({ payee: "Transfer", date: "2026-03-01", amount: -100, is_transfer: true })
    );
    const result = await detectRecurringTransactions();
    expect(result).toEqual([]);
  });

  it("detects income transactions as 'Einnahme'", async () => {
    mockTransactions.push(
      tx({ payee: "Employer", date: "2026-01-01", amount: 2500 }),
      tx({ payee: "Employer", date: "2026-02-01", amount: 2500 }),
      tx({ payee: "Employer", date: "2026-03-01", amount: 2500 })
    );
    const result = await detectRecurringTransactions();
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("Einnahme");
  });

  it("handles irregular but mostly regular intervals", async () => {
    mockTransactions.push(
      tx({ payee: "Coffee", date: "2026-01-01", amount: -5.0 }),
      tx({ payee: "Coffee", date: "2026-02-01", amount: -5.0 }),
      tx({ payee: "Coffee", date: "2026-02-28", amount: -5.0 }),
      tx({ payee: "Coffee", date: "2026-04-01", amount: -5.0 })
    );
    const result = await detectRecurringTransactions();
    // Should detect as monthly even with slight variation
    expect(result.length).toBeGreaterThan(0);
  });
});
