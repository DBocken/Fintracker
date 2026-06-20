import { describe, expect, it, beforeEach } from "vitest";
import {
  createReceivable,
  getReceivables,
  getTotalReceivables,
  assignTransactionToReceivable,
  unassignReceivableTransaction,
  getReceivableTransactionAssignments,
  suggestReceivableRepayments,
} from "../receivable-service";
import { createTransaction } from "../transaction-service";
import { writeLocalFinanceList } from "../local-finance-store";
import type { Receivable, Transaction } from "../../types";

function makeReceivable(overrides: Partial<Receivable>): Receivable {
  return {
    id: overrides.id || crypto.randomUUID(),
    user_id: "local",
    name: "Forderung",
    type: "private_loan",
    amount: 0,
    is_cash: false,
    is_settled: false,
    ...overrides,
  };
}

beforeEach(async () => {
  await writeLocalFinanceList("receivables", []);
  await writeLocalFinanceList("receivableAssignments", []);
});

describe("getTotalReceivables", () => {
  it("sums open amounts, ignoring settled and negative ones", () => {
    const receivables = [
      makeReceivable({ amount: 100 }),
      makeReceivable({ amount: 50 }),
      makeReceivable({ amount: 999, is_settled: true }),
      makeReceivable({ amount: -10 }),
    ];
    expect(getTotalReceivables(receivables)).toBeCloseTo(150);
  });
});

describe("suggestReceivableRepayments", () => {
  it("matches incoming transactions by debtor name and ignores outgoing", () => {
    const receivable = makeReceivable({ name: "Ticket", debtor: "Max Mustermann" });
    const txs: Transaction[] = [
      { id: "1", date: "2026-06-01", amount: 20, payee: "Max Mustermann", description: "", original_text: "", auto_mapped: false, confirmed: false },
      { id: "2", date: "2026-06-02", amount: -20, payee: "Max Mustermann", description: "", original_text: "", auto_mapped: false, confirmed: false },
      { id: "3", date: "2026-06-03", amount: 99, payee: "Edeka", description: "", original_text: "", auto_mapped: false, confirmed: false },
    ];
    const matches = suggestReceivableRepayments(receivable, txs);
    expect(matches.map((t) => t.id)).toEqual(["1"]);
  });
});

describe("assign / unassign receivable repayments", () => {
  it("reduces the open amount on assignment and restores it on unassign", async () => {
    const receivable = await createReceivable({ name: "Darlehen", amount: 100, debtor: "Anna" });
    const income = await createTransaction({
      date: "2026-06-10",
      amount: 30,
      payee: "Anna",
      description: "Teilrückzahlung",
    });

    await assignTransactionToReceivable({ receivableId: receivable.id, transactionId: income.id! });

    let stored = (await getReceivables()).find((r) => r.id === receivable.id)!;
    expect(stored.amount).toBeCloseTo(70);
    expect(stored.is_settled).toBe(false);

    const assignments = await getReceivableTransactionAssignments();
    expect(assignments).toHaveLength(1);

    await unassignReceivableTransaction(assignments[0].id);
    stored = (await getReceivables()).find((r) => r.id === receivable.id)!;
    expect(stored.amount).toBeCloseTo(100);
    expect(await getReceivableTransactionAssignments()).toHaveLength(0);
  });

  it("settles the receivable when fully repaid", async () => {
    const receivable = await createReceivable({ name: "Klein", amount: 25 });
    const income = await createTransaction({ date: "2026-06-10", amount: 25, payee: "Bob" });

    await assignTransactionToReceivable({ receivableId: receivable.id, transactionId: income.id! });

    const stored = (await getReceivables()).find((r) => r.id === receivable.id)!;
    expect(stored.amount).toBeCloseTo(0);
    expect(stored.is_settled).toBe(true);
  });

  it("rejects assigning an outgoing transaction as a repayment", async () => {
    const receivable = await createReceivable({ name: "X", amount: 50 });
    const expense = await createTransaction({ date: "2026-06-10", amount: -10, payee: "Y" });

    await expect(
      assignTransactionToReceivable({ receivableId: receivable.id, transactionId: expense.id! }),
    ).rejects.toThrow();
  });
});
