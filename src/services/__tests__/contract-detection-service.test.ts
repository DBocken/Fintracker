import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Transaction } from "../../types";
import type { ContractRow } from "@/components/contracts/contract-types";

const mockTransactions: Transaction[] = [];
const updateTransactionMock = vi.fn((updates: unknown) => Promise.resolve(updates));

vi.mock("../transaction-service", () => ({
  getTransactions: vi.fn(() => Promise.resolve(mockTransactions)),
  updateTransaction: (updates: unknown) => updateTransactionMock(updates),
}));

import {
  applyDetectedContracts,
  detectRecurringTransactions,
  matchContractsToTransactions,
} from "../contract-detection-service";

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

function contractRow(overrides: Partial<ContractRow>): ContractRow {
  return {
    key: "k",
    type: "Ausgabe",
    payee: "LSW Energie",
    categoryName: "Wohnen",
    categoryId: "wohnen",
    amountTypical: 49.99,
    amountLast: 49.99,
    cycle: "Monatlich",
    lastDateISO: "2026-03-01",
    nextDateISO: "2026-04-01",
    changed: false,
    changeAmount: 0,
    changeSinceLabel: null,
    ...overrides,
  };
}

describe("matchContractsToTransactions", () => {
  it("markiert Transaktionen mit passendem Payee und Betrag als Vertrag", () => {
    const txns = [
      tx({ id: "1", payee: "LSW Energie", amount: -49.99 }),
      tx({ id: "2", payee: "LSW Energie", amount: -49.99 }),
      tx({ id: "3", payee: "REWE", amount: -49.99 }),
    ];
    const updates = matchContractsToTransactions(txns, [contractRow({})]);
    expect(updates.map((u) => u.id)).toEqual(["1", "2"]);
    expect(updates[0]).toMatchObject({ is_contract: true, contract_cycle: "monthly" });
  });

  it("erfasst auch den erhöhten (letzten) Betrag", () => {
    const txns = [
      tx({ id: "1", payee: "Internet", amount: -49.99 }),
      tx({ id: "2", payee: "Internet", amount: -59.99 }),
    ];
    const row = contractRow({ payee: "Internet", amountTypical: 49.99, amountLast: 59.99 });
    const updates = matchContractsToTransactions(txns, [row]);
    expect(updates.map((u) => u.id).sort()).toEqual(["1", "2"]);
  });

  it("lässt einmalige Sonderbeträge desselben Payees aus", () => {
    const txns = [
      tx({ id: "1", payee: "LSW Energie", amount: -49.99 }),
      tx({ id: "2", payee: "LSW Energie", amount: -250.0 }), // Nachzahlung
    ];
    const updates = matchContractsToTransactions(txns, [contractRow({})]);
    expect(updates.map((u) => u.id)).toEqual(["1"]);
  });

  it("setzt den Zyklus auf null bei nicht abbildbarem Cycle", () => {
    const txns = [tx({ id: "1", payee: "Versicherung", amount: -120 })];
    const row = contractRow({ payee: "Versicherung", amountTypical: 120, amountLast: 120, cycle: "Halbjährlich" });
    const updates = matchContractsToTransactions(txns, [row]);
    expect(updates[0].contract_cycle).toBeNull();
    expect(updates[0].is_contract).toBe(true);
  });

  it("ignoriert Transfers und Transaktionen ohne ID", () => {
    const txns = [
      tx({ id: undefined, payee: "LSW Energie", amount: -49.99 }),
      tx({ id: "2", payee: "LSW Energie", amount: -49.99, is_transfer: true }),
    ];
    expect(matchContractsToTransactions(txns, [contractRow({})])).toEqual([]);
  });
});

describe("applyDetectedContracts", () => {
  beforeEach(() => {
    mockTransactions.length = 0;
    updateTransactionMock.mockClear();
  });

  it("erkennt Verträge und persistiert die Markierungen", async () => {
    mockTransactions.push(
      tx({ id: "1", payee: "LSW Energie", date: "2026-01-01", amount: -49.99 }),
      tx({ id: "2", payee: "LSW Energie", date: "2026-02-01", amount: -49.99 }),
      tx({ id: "3", payee: "LSW Energie", date: "2026-03-01", amount: -49.99 })
    );

    const count = await applyDetectedContracts();

    expect(count).toBe(3);
    expect(updateTransactionMock).toHaveBeenCalledTimes(1);
    const updates = updateTransactionMock.mock.calls[0][0] as { id: string; is_contract: boolean }[];
    expect(updates.map((u) => u.id).sort()).toEqual(["1", "2", "3"]);
    expect(updates.every((u) => u.is_contract)).toBe(true);
  });

  it("schreibt nichts, wenn keine Verträge erkannt werden", async () => {
    mockTransactions.push(tx({ id: "1", payee: "Einmalig", amount: -10 }));
    const count = await applyDetectedContracts();
    expect(count).toBe(0);
    expect(updateTransactionMock).not.toHaveBeenCalled();
  });
});
