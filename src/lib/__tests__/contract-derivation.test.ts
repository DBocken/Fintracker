import { describe, it, expect } from "vitest";
import {
  computeContracts,
  isActiveForTotals,
  monthlyEquivalent,
  yearlyEquivalent,
  getCycleFromDays,
} from "@/lib/contract-derivation";
import type { Transaction, Category } from "@/types";
import type { ContractDecision } from "@/services/contract-decision-service";
import { merchantFingerprint } from "@/lib/merchant-fingerprint";

const NOW = new Date("2024-06-01");

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

/** A monthly Netflix-like series ending shortly before NOW. */
function monthlySeries(payee: string, amount: number, months: number, lastMonth = 5): Transaction[] {
  const out: Transaction[] = [];
  for (let i = 0; i < months; i++) {
    const m = lastMonth - (months - 1 - i);
    const mm = String(m + 1).padStart(2, "0");
    out.push(tx({ id: `${payee}-${i}`, payee, amount, date: `2024-${mm}-15` }));
  }
  return out;
}

describe("cycle + equivalents", () => {
  it("maps day gaps to cycles", () => {
    expect(getCycleFromDays(30)).toBe("Monatlich");
    expect(getCycleFromDays(7)).toBe("Wöchentlich");
    expect(getCycleFromDays(250)).toBe("Unbekannt"); // gap between half-year and yearly windows
  });

  it("does not guess for unknown cycles", () => {
    expect(monthlyEquivalent(10, "Unbekannt")).toBe(0);
    expect(yearlyEquivalent(10, "Unbekannt")).toBe(0);
    expect(yearlyEquivalent(10, "Monatlich")).toBe(120);
  });
});

describe("computeContracts status awareness", () => {
  const cats = new Map<string, Category>();

  it("derives a candidate from a stable monthly series", () => {
    const rows = computeContracts(monthlySeries("Netflix", -12, 4), cats, "Ausgabe", { now: NOW });
    expect(rows).toHaveLength(1);
    expect(rows[0].cycle).toBe("Monatlich");
    expect(rows[0].status).toBe("candidate");
    expect(rows[0].cycleKnown).toBe(true);
  });

  it("marks confirmed transactions as active", () => {
    const series = monthlySeries("Spotify", -10, 4).map((t) => ({ ...t, is_contract: true }));
    const rows = computeContracts(series, cats, "Ausgabe", { now: NOW });
    expect(rows[0].status).toBe("active");
    expect(isActiveForTotals(rows[0])).toBe(true);
  });

  it("a rejected decision keeps the row out of totals", () => {
    const series = monthlySeries("Gym", -30, 4).map((t) => ({ ...t, is_contract: true }));
    const fp = merchantFingerprint(series[0]);
    const decisions = new Map<string, ContractDecision>([
      [fp, { id: "1", user_id: "local", fingerprint: fp, status: "rejected" }],
    ]);
    const rows = computeContracts(series, cats, "Ausgabe", { now: NOW, decisions });
    expect(rows[0].status).toBe("rejected");
    expect(isActiveForTotals(rows[0])).toBe(false);
  });

  it("an ended contract is excluded from totals", () => {
    const series = monthlySeries("OldMag", -8, 4).map((t) => ({ ...t, is_contract: true }));
    const fp = merchantFingerprint(series[0]);
    const decisions = new Map<string, ContractDecision>([
      [fp, { id: "2", user_id: "local", fingerprint: fp, status: "ended", ended_at: "2024-03-01" }],
    ]);
    const rows = computeContracts(series, cats, "Ausgabe", { now: NOW, decisions });
    expect(isActiveForTotals(rows[0])).toBe(false);
  });

  it("[INTEGRITY] a rejected decision survives a historical reimport with additional matching rows", () => {
    const original = monthlySeries("Former Provider", -19.99, 4, 3).map((t) => ({ ...t, is_contract: true }));
    const fingerprint = merchantFingerprint(original[0]);
    const decisions = new Map<string, ContractDecision>([[
      fingerprint,
      { id: "rejected-forever", user_id: "local", fingerprint, status: "rejected" },
    ]]);
    const reimported = [
      ...original,
      tx({ id: "historic-extra", payee: "Former Provider", amount: -19.99, date: "2023-12-15", is_contract: true }),
    ];

    const rows = computeContracts(reimported, cats, "Ausgabe", { now: NOW, decisions });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("rejected");
    expect(isActiveForTotals(rows[0])).toBe(false);
  });

  it("stale active contracts (last booking > 2 cycles ago) are excluded from totals", () => {
    // monthly series whose last booking is 2023, far before NOW (2024-06)
    const series = [
      tx({ id: "a", payee: "DeadSub", amount: -9, date: "2023-01-15", is_contract: true }),
      tx({ id: "b", payee: "DeadSub", amount: -9, date: "2023-02-15", is_contract: true }),
      tx({ id: "c", payee: "DeadSub", amount: -9, date: "2023-03-15", is_contract: true }),
    ];
    const rows = computeContracts(series, cats, "Ausgabe", { now: NOW });
    expect(rows[0].status).toBe("active");
    expect(rows[0].stale).toBe(true);
    expect(isActiveForTotals(rows[0])).toBe(false);
  });
});
