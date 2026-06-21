import { describe, it, expect } from "vitest";
import {
  merchantFingerprint,
  merchantFingerprintInfo,
  transactionDirection,
  findSimilarTransactions,
} from "@/lib/merchant-fingerprint";
import type { Transaction } from "@/types";

function tx(partial: Partial<Transaction>): Transaction {
  return {
    date: "2024-01-01",
    amount: -10,
    payee: "Test",
    description: "",
    original_text: "",
    auto_mapped: false,
    confirmed: false,
    ...partial,
  };
}

describe("transactionDirection", () => {
  it("classifies by sign", () => {
    expect(transactionDirection(tx({ amount: -5 }))).toBe("out");
    expect(transactionDirection(tx({ amount: 5 }))).toBe("in");
    expect(transactionDirection(tx({ amount: 0 }))).toBe("in");
  });
});

describe("merchantFingerprint", () => {
  it("prefers the counterparty IBAN over the payee name", () => {
    const a = tx({ payee: "Netflix Intl", counterparty_iban: "DE89 3704 0044 0532 0130 00", amount: -12 });
    const b = tx({ payee: "NETFLIX 12345 SEPA", counterparty_iban: "de89370400440532013000", amount: -13 });
    expect(merchantFingerprintInfo(a).reason).toBe("iban");
    expect(merchantFingerprint(a)).toBe(merchantFingerprint(b));
  });

  it("falls back to the normalized merchant name", () => {
    const a = tx({ payee: "SEPA Lastschrift Netflix", amount: -12 });
    const b = tx({ payee: "Netflix GmbH", amount: -12 });
    expect(merchantFingerprintInfo(a).reason).toBe("merchant");
    expect(merchantFingerprint(a)).toBe(merchantFingerprint(b));
  });

  it("separates income from expense for the same merchant", () => {
    const out = tx({ payee: "Amazon", amount: -20 });
    const inc = tx({ payee: "Amazon", amount: 20 });
    expect(merchantFingerprint(out)).not.toBe(merchantFingerprint(inc));
  });
});

describe("findSimilarTransactions", () => {
  it("splits exact (same account + amount corridor) from probable", () => {
    const target = tx({ id: "1", payee: "Spotify", amount: -9.99, account_id: "acc1" });
    const all = [
      target,
      tx({ id: "2", payee: "Spotify", amount: -9.99, account_id: "acc1" }), // exact
      tx({ id: "3", payee: "spotify", amount: -10.5, account_id: "acc1" }), // exact (within 10%)
      tx({ id: "4", payee: "Spotify", amount: -19.99, account_id: "acc1" }), // probable (amount off)
      tx({ id: "5", payee: "Spotify", amount: -9.99, account_id: "acc2" }), // probable (other account)
      tx({ id: "6", payee: "Aldi", amount: -9.99, account_id: "acc1" }), // unrelated
    ];
    const res = findSimilarTransactions(target, all);
    expect(res.exact.map((t) => t.id).sort()).toEqual(["2", "3"]);
    expect(res.probable.map((t) => t.id).sort()).toEqual(["4", "5"]);
  });

  it("excludes the target itself by identity and by id", () => {
    const target = tx({ id: "1", payee: "X", amount: -5, account_id: "a" });
    const res = findSimilarTransactions(target, [target]);
    expect(res.exact).toHaveLength(0);
    expect(res.probable).toHaveLength(0);
  });
});
