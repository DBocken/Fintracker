import { describe, expect, it } from "vitest";
import { detectCashWithdrawals, recordCashWithdrawal, findCashAccount } from "../cash-service";
import { getTransactions } from "../transaction-service";
import type { Account, Transaction } from "../../types";

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id || crypto.randomUUID(),
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

function acc(overrides: Partial<Account>): Account {
  return {
    id: overrides.id || crypto.randomUUID(),
    user_id: "local",
    name: "Konto",
    type: "checking",
    currency: "EUR",
    color: "#000",
    icon: "🏦",
    is_budget_pool_member: true,
    order_index: 0,
    ...overrides,
  };
}

describe("detectCashWithdrawals", () => {
  it("detects ATM-like debits and ignores credits, transfers and the cash account itself", () => {
    const txs = [
      tx({ id: "a", amount: -50, payee: "Geldautomat Sparkasse" }),
      tx({ id: "b", amount: -20, description: "Bargeldauszahlung" }),
      tx({ id: "c", amount: 50, payee: "Geldautomat" }), // credit, ignored
      tx({ id: "d", amount: -30, payee: "Geldautomat", is_transfer: true }), // already transfer
      tx({ id: "e", amount: -10, payee: "Edeka" }), // not ATM
      tx({ id: "f", amount: -40, payee: "Geldautomat", account_id: "cash" }), // on cash account
    ];
    const result = detectCashWithdrawals(txs, "cash");
    expect(result.map((t) => t.id).sort()).toEqual(["a", "b"]);
  });
});

describe("findCashAccount", () => {
  it("returns the first cash account", () => {
    const accounts = [acc({ id: "1", type: "checking" }), acc({ id: "2", type: "cash" })];
    expect(findCashAccount(accounts)?.id).toBe("2");
  });
});

describe("recordCashWithdrawal", () => {
  it("creates a linked transfer pair: debit on source, credit on cash", async () => {
    const { debit, credit } = await recordCashWithdrawal({
      sourceAccountId: "giro",
      cashAccountId: "cash",
      amount: 100,
      date: "2026-06-15",
    });

    expect(debit.amount).toBeCloseTo(-100);
    expect(credit.amount).toBeCloseTo(100);

    const stored = await getTransactions(50);
    const storedDebit = stored.find((t) => t.id === debit.id)!;
    const storedCredit = stored.find((t) => t.id === credit.id)!;
    expect(storedDebit.is_transfer).toBe(true);
    expect(storedCredit.is_transfer).toBe(true);
    expect(storedDebit.transfer_pair_id).toBe(credit.id);
    expect(storedCredit.transfer_pair_id).toBe(debit.id);
    expect(storedCredit.account_id).toBe("cash");
  });

  it("rejects identical source and cash accounts", async () => {
    await expect(
      recordCashWithdrawal({ sourceAccountId: "x", cashAccountId: "x", amount: 10, date: "2026-06-15" }),
    ).rejects.toThrow();
  });
});
