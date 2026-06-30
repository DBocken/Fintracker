import { describe, expect, it } from "vitest";
import {
  assessDebtCounseling,
  estimateAvailableIncome,
  payoffPlanToPlanMonths,
} from "@/lib/debt-counseling";
import { OVERINDEBTEDNESS_PLAN_MONTHS } from "@/services/debt-guardrails-service";

describe("debt-counseling Brücke", () => {
  describe("payoffPlanToPlanMonths", () => {
    it("sollte die Plandauer durchreichen, wenn das Budget reicht", () => {
      expect(payoffPlanToPlanMonths({ totalMonths: 24, insufficientBudget: false })).toBe(24);
    });

    it("sollte null liefern, wenn das Budget nicht für die Mindestraten reicht", () => {
      expect(payoffPlanToPlanMonths({ totalMonths: 0, insufficientBudget: true })).toBeNull();
    });

    it("sollte 0 Monate (keine Schulden) als 0 behandeln, nicht als null", () => {
      expect(payoffPlanToPlanMonths({ totalMonths: 0, insufficientBudget: false })).toBe(0);
    });
  });

  describe("estimateAvailableIncome", () => {
    it("sollte Mindestraten zurückaddieren (in Ausgaben enthalten)", () => {
      // Einkommen 2000, Ausgaben 1800 (inkl. 300 Raten) → frei für Tilgung 500.
      expect(estimateAvailableIncome(2000, 1800, 300)).toBe(500);
    });

    it("sollte nie negativ werden", () => {
      expect(estimateAvailableIncome(1000, 2000, 100)).toBe(0);
    });

    it("[Edge] sollte +Infinity liefern, wenn kein Einkommen bekannt ist", () => {
      expect(estimateAvailableIncome(0, 0, 200)).toBe(Number.POSITIVE_INFINITY);
      expect(estimateAvailableIncome(-50, 100, 200)).toBe(Number.POSITIVE_INFINITY);
    });
  });

  describe("assessDebtCounseling", () => {
    it("sollte bei gesundem, kurzem Plan NICHT empfehlen", () => {
      const rec = assessDebtCounseling({
        plan: { totalMonths: 18, insufficientBudget: false },
        monthlyRate: 300,
        minPayments: 300,
        monthlyIncome: 2500,
        monthlyExpenses: 2000,
      });
      expect(rec.recommended).toBe(false);
      expect(rec.reason).toBeNull();
    });

    it("sollte empfehlen, wenn der Plan länger als die Restschuldbefreiung dauert", () => {
      const rec = assessDebtCounseling({
        plan: { totalMonths: OVERINDEBTEDNESS_PLAN_MONTHS + 1, insufficientBudget: false },
        monthlyRate: 200,
        minPayments: 200,
        monthlyIncome: 2500,
        monthlyExpenses: 2000,
      });
      expect(rec.recommended).toBe(true);
      expect(rec.reason).toContain("Jahre");
      expect(rec.services.length).toBeGreaterThan(0);
      expect(rec.warning.length).toBeGreaterThan(0);
    });

    it("sollte empfehlen, wenn das Budget die Mindestraten nicht deckt (Plan geht nie auf)", () => {
      const rec = assessDebtCounseling({
        plan: { totalMonths: 0, insufficientBudget: true },
        monthlyRate: 400,
        minPayments: 400,
        monthlyIncome: 2000,
        monthlyExpenses: 1900,
      });
      expect(rec.recommended).toBe(true);
      expect(rec.reason).not.toBeNull();
    });

    it("[Edge] sollte ohne bekanntes Einkommen NUR plan-basiert auslösen", () => {
      const rec = assessDebtCounseling({
        plan: { totalMonths: 24, insufficientBudget: false },
        monthlyRate: 5000,
        minPayments: 5000,
        monthlyIncome: 0,
        monthlyExpenses: 0,
      });
      // Plan ist kurz & geht auf, Einkommen unbekannt → kein Fehlalarm.
      expect(rec.recommended).toBe(false);
    });
  });
});
