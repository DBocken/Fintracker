import { describe, expect, it } from "vitest";
import {
  parseExtraBudget,
  summarizeDebtCauses,
  sumAssignedAmounts,
} from "../debt-overview";
import type { Debt } from "@/types";
import type { DebtTransactionAssignment } from "@/lib/debt-types";

function makeDebt(overrides: Partial<Debt>): Debt {
  return {
    id: overrides.id || "debt",
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

function makeAssignment(amount: number, debtId = "a"): DebtTransactionAssignment {
  return {
    id: `assignment-${amount}-${debtId}`,
    user_id: "local",
    debt_id: debtId,
    transaction_id: `tx-${amount}`,
    amount,
    created_at: "2026-08-07T00:00:00.000Z",
  };
}

const LABELS = {
  installment: "Ratenkauf",
  other: "Sonstiges",
  credit_card: "Kreditkarte",
} as Record<string, string>;

describe("parseExtraBudget", () => {
  it("sollte eine leere Eingabe als 0 lesen", () => {
    expect(parseExtraBudget("")).toBe(0);
    expect(parseExtraBudget("   ")).toBe(0);
  });

  it("sollte eine unlesbare Eingabe als 0 lesen statt zu werfen", () => {
    // Das Feld wird beim Tippen ausgewertet — ein halb eingegebener Betrag
    // darf keinen Fehler auslösen. Deshalb `parseGermanNumber ?? 0` und
    // nicht `parseEuroInput` (das wirft).
    expect(parseExtraBudget("abc")).toBe(0);
    expect(parseExtraBudget("-")).toBe(0);
    expect(parseExtraBudget(null)).toBe(0);
  });

  it("[REGRESSION] sollte den deutschen Tausenderpunkt nicht als Dezimaltrenner lesen", () => {
    // `parseFloat("1.200")` liefert 1.2. Wer 1.200 € zusätzliche Tilgung
    // eintippt, bekam einen Plan, der mit 1,20 € rechnet — und die
    // Überschuldungs-Heuristik daneben entscheidet daraufhin, ob überhaupt
    // eine Schuldnerberatung angeboten wird. Genau dafür verbietet AGENTS.md
    // §8 rohes `parseFloat` für Geldeingaben.
    expect(parseExtraBudget("1.200")).toBe(1200);
    expect(parseExtraBudget("1.234,56")).toBe(1234.56);
  });

  it("[REGRESSION] sollte das deutsche Dezimalkomma nicht verschlucken", () => {
    // `parseFloat("12,50")` liefert 12 — die Cent fielen still weg.
    expect(parseExtraBudget("12,50")).toBe(12.5);
  });

  it("sollte auch ein Zahl-Argument annehmen", () => {
    expect(parseExtraBudget(250)).toBe(250);
  });
});

describe("sumAssignedAmounts", () => {
  it("sollte eine leere Liste als 0 summieren", () => {
    expect(sumAssignedAmounts([])).toBe(0);
  });

  it("sollte Beträge summieren", () => {
    expect(sumAssignedAmounts([makeAssignment(100), makeAssignment(50)])).toBe(150);
  });

  it("[REGRESSION] sollte centgenau summieren statt Float-Drift anzuhäufen", () => {
    expect(sumAssignedAmounts([makeAssignment(0.1), makeAssignment(0.2)])).toBe(0.3);
  });
});

describe("summarizeDebtCauses", () => {
  it("sollte ohne aktive Schulden nichts ausweisen", () => {
    expect(summarizeDebtCauses([], LABELS)).toEqual([]);
    expect(summarizeDebtCauses([makeDebt({ balance: 500, is_paid_off: true })], LABELS)).toEqual([]);
  });

  it("sollte nach Schuldenart gruppieren und absteigend sortieren", () => {
    const debts = [
      makeDebt({ id: "a", type: "other", balance: 250 }),
      makeDebt({ id: "b", type: "credit_card", balance: 750 }),
    ];
    expect(summarizeDebtCauses(debts, LABELS)).toEqual([
      { label: "Kreditkarte", amount: 750, pct: 75 },
      { label: "Sonstiges", amount: 250, pct: 25 },
    ]);
  });

  it("sollte BNPL über den Anbieter ausweisen statt über die Art", () => {
    const debts = [makeDebt({ id: "a", is_bnpl: true, provider: "Klarna", balance: 100 })];
    expect(summarizeDebtCauses(debts, LABELS)[0].label).toBe("Klarna");
  });

  it('sollte für BNPL ohne Anbieter auf „Ratenkauf" zurückfallen', () => {
    const debts = [makeDebt({ id: "a", is_bnpl: true, provider: null, balance: 100 })];
    expect(summarizeDebtCauses(debts, LABELS)[0].label).toBe("Ratenkauf");
  });

  it("sollte Schulden ohne Stand und abbezahlte auslassen", () => {
    const debts = [
      makeDebt({ id: "a", type: "other", balance: 100 }),
      makeDebt({ id: "b", type: "credit_card", balance: 0 }),
      makeDebt({ id: "c", type: "credit_card", balance: 900, is_paid_off: true }),
    ];
    expect(summarizeDebtCauses(debts, LABELS)).toEqual([
      { label: "Sonstiges", amount: 100, pct: 100 },
    ]);
  });

  it("[REGRESSION] sollte centgenau gruppieren statt Float-Drift anzuhäufen", () => {
    const debts = [
      makeDebt({ id: "a", type: "other", balance: 0.1 }),
      makeDebt({ id: "b", type: "other", balance: 0.2 }),
      makeDebt({ id: "c", type: "credit_card", balance: 0.7 }),
    ];
    const [first, second] = summarizeDebtCauses(debts, LABELS);
    expect(first).toEqual({ label: "Kreditkarte", amount: 0.7, pct: 70 });
    expect(second).toEqual({ label: "Sonstiges", amount: 0.3, pct: 30 });
  });
});
