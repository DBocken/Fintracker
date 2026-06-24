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

  it("erkennt eine aktuelle Gehaltsserie und gewichtet den jüngsten Betrag", () => {
    const dates = [
      "2023-07-31", "2023-08-28", "2023-09-29", "2023-10-29", "2023-11-27", "2023-12-29",
      "2024-01-28", "2024-02-27", "2024-03-30", "2024-04-29", "2024-05-28",
    ];
    const salary = dates.map((date, index) => tx({
      id: `salary-${index}`,
      payee: "BREDEX",
      amount: index < 6 ? 4044.26 : 4028.48,
      date,
      description: `Lohn - Gehalt Abrechnung ${index + 1}`,
    }));

    const rows = computeContracts(salary, cats, "Einnahme", { now: NOW });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "Einnahme",
      cycle: "Monatlich",
      status: "candidate",
      amountRecentTypical: 4028.48,
      stale: false,
    });
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

  it("[REGRESSION] erkennt Energieversorger mit Abschlagserhöhung als Kandidat", () => {
    // Typisches Stadtwerke-Modell: monatlicher Abschlag, Erhöhung nach 3 Monaten (~15 % Anstieg)
    const series = [
      tx({ id: "e1", payee: "Stadtwerke", amount: -150, date: "2024-01-15" }),
      tx({ id: "e2", payee: "Stadtwerke", amount: -150, date: "2024-02-15" }),
      tx({ id: "e3", payee: "Stadtwerke", amount: -150, date: "2024-03-15" }),
      tx({ id: "e4", payee: "Stadtwerke", amount: -175, date: "2024-04-15" }),
      tx({ id: "e5", payee: "Stadtwerke", amount: -175, date: "2024-05-15" }),
    ];
    // median = 150, stddev ≈ 12 (8 % von median) → sollte mit 20 %-Schwelle erkannt werden
    const rows = computeContracts(series, cats, "Ausgabe", { now: NOW });
    expect(rows).toHaveLength(1);
    expect(rows[0].cycle).toBe("Monatlich");
    expect(rows[0].status).toBe("candidate");
  });

  it("[REGRESSION] Gehaltsbuchung mit Betragswechsel wird weiterhin erkannt", () => {
    // Gehalt: 6 Monate 4044€, dann 5 Monate 4028€ → stddev ≈ 8€ << 20% × 4035€
    const dates = [
      "2023-08-28", "2023-09-29", "2023-10-29", "2023-11-27", "2023-12-29",
      "2024-01-28", "2024-02-27", "2024-03-30", "2024-04-29", "2024-05-28",
    ];
    const salary = dates.map((date, i) =>
      tx({ id: `s-${i}`, payee: "Arbeitgeber AG", amount: i < 5 ? 4044.26 : 4028.48, date })
    );
    const rows = computeContracts(salary, cats, "Einnahme", { now: NOW });
    expect(rows).toHaveLength(1);
    expect(rows[0].cycle).toBe("Monatlich");
  });
});
