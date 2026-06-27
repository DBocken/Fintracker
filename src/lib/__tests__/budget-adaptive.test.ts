import { describe, it, expect } from "vitest";
import type { Budget, Category, Transaction } from "@/types";
import {
  median,
  trailingMonths,
  buildAdaptiveBaseLimit,
  computeAdaptiveBaseline,
} from "@/lib/budget-adaptive";
import { roundSuggestion } from "@/lib/budget-logic";
import { computeRolloverLedger } from "@/lib/budget-rollover";

const cat = (over: Partial<Category> & { id: string }): Category => ({
  name: over.id,
  filters: [],
  ...over,
});

const tx = (over: Partial<Transaction> & { date: string; amount: number }): Transaction => ({
  payee: "",
  description: "",
  original_text: "",
  auto_mapped: false,
  confirmed: true,
  ...over,
});

const budget = (over: Partial<Budget> & { id: string; category_id: string; limit: number }): Budget => ({
  name: over.id,
  ...over,
});

const CATEGORIES: Category[] = [
  cat({ id: "wohnen", name: "Wohnen" }),
  cat({ id: "miete", name: "Miete", parent_id: "wohnen" }),
];

/** Baut Ausgaben-Transaktionen aus [Monat, Betrag]-Paaren (zählen für ein Wohnen-Budget). */
const spends = (entries: [string, number][]): Transaction[] =>
  entries.map(([m, a]) => tx({ date: `${m}-15`, amount: -a, category_id: "miete" }));

const B = budget({ id: "b", category_id: "wohnen", limit: 1000 });

describe("budget-adaptive", () => {
  describe("median", () => {
    it("sollte den Median bei ungerader Anzahl liefern", () => {
      expect(median([300, 500, 400])).toBe(400);
    });
    it("sollte bei gerader Anzahl mitteln", () => {
      expect(median([300, 500, 400, 600])).toBe(450);
    });
    it("sollte robust gegen Ausreißer sein (vs. Mittelwert)", () => {
      // Mittelwert wäre 850; Median bleibt bei 200.
      expect(median([100, 200, 300, 3000])).toBe(250);
    });
    it("sollte mit leerer Liste 0 liefern", () => {
      expect(median([])).toBe(0);
    });
  });

  describe("trailingMonths", () => {
    it("sollte die n Monate vor der Periode chronologisch liefern", () => {
      expect(trailingMonths("2026-06", 3)).toEqual(["2026-03", "2026-04", "2026-05"]);
    });
    it("sollte über die Jahresgrenze rechnen", () => {
      expect(trailingMonths("2026-02", 3)).toEqual(["2025-11", "2025-12", "2026-01"]);
    });
  });

  describe("buildAdaptiveBaseLimit", () => {
    it("sollte das Basislimit aus dem Median des Fensters bilden (gerundet)", () => {
      const fn = buildAdaptiveBaseLimit(B, spends([["2026-03", 300], ["2026-04", 500], ["2026-05", 400]]), CATEGORIES, {
        windowMonths: 3,
      });
      expect(fn("2026-06")).toBe(roundSuggestion(400)); // Median 400
    });

    it("sollte führende Nullmonate (Vor-Historie) ignorieren", () => {
      // Fenster 4 würde 2026-02 (=0) enthalten; ohne Trim verzerrte das den Median.
      const fn = buildAdaptiveBaseLimit(B, spends([["2026-03", 300], ["2026-04", 500], ["2026-05", 400]]), CATEGORIES, {
        windowMonths: 4,
      });
      expect(fn("2026-06")).toBe(roundSuggestion(400)); // weiterhin Median(300,500,400)=400
    });

    it("sollte ohne jede Historie auf das Basislimit zurückfallen", () => {
      const fn = buildAdaptiveBaseLimit(B, [], CATEGORIES, { windowMonths: 3 });
      expect(fn("2026-06")).toBe(1000);
    });

    it("sollte sich als baseLimitFor in die Rollover-Engine einfügen", () => {
      const b = budget({ id: "b", category_id: "wohnen", limit: 1000, rolloverConfig: { mode: "accumulate" } });
      const txs = spends([
        ["2026-03", 300], ["2026-04", 500], ["2026-05", 400], // Fenster für 2026-06
        ["2026-06", 350], // Ausgaben im betrachteten Monat
      ]);
      const baseLimitFor = buildAdaptiveBaseLimit(b, txs, CATEGORIES, { windowMonths: 3 });
      const led = computeRolloverLedger(b, txs, CATEGORIES, ["2026-06"], undefined, { baseLimitFor });
      expect(led[0].baseLimit).toBe(roundSuggestion(400)); // 420
      expect(led[0].spent).toBe(350);
      expect(led[0].remaining).toBe(roundSuggestion(400) - 350);
    });
  });

  describe("computeAdaptiveBaseline", () => {
    it("sollte Median, monthsOfData und das learning-Flag liefern", () => {
      // Nur 2 Monate Daten → unter Mindesthistorie (minMonths 3) → learning.
      const out = computeAdaptiveBaseline(B, spends([["2026-04", 300], ["2026-05", 500]]), CATEGORIES, {
        currentMonth: "2026-05",
        windowMonths: 6,
        seasonality: false,
      });
      expect(out.median).toBe(400);
      expect(out.monthsOfData).toBe(2);
      expect(out.learning).toBe(true);
      expect(out.seasonalFactor).toBe(1);
      expect(out.baseLimit).toBe(roundSuggestion(400));
    });

    it("sollte bei genügend Historie nicht mehr 'lernend' sein", () => {
      const out = computeAdaptiveBaseline(
        B,
        spends([["2026-01", 400], ["2026-02", 400], ["2026-03", 400], ["2026-04", 400], ["2026-05", 400]]),
        CATEGORIES,
        { currentMonth: "2026-05", windowMonths: 6, minMonths: 3, seasonality: false },
      );
      expect(out.learning).toBe(false);
      expect(out.monthsOfData).toBe(5);
    });

    describe("Saisonalität", () => {
      // 24 Monate Historie; jeder Dezember erhöht (200 statt 100).
      const seasonal = (): Transaction[] => {
        const entries: [string, number][] = [];
        for (let i = 0; i < 24; i++) {
          const year = 2024 + Math.floor((i + 11) / 12); // ab 2024-12
          const month = ((i + 11) % 12) + 1;
          const key = `${year}-${String(month).padStart(2, "0")}`;
          entries.push([key, month === 12 ? 200 : 100]);
        }
        return spends(entries);
      };

      it("sollte für einen saisonal hohen Monat einen Faktor > 1 anwenden", () => {
        const out = computeAdaptiveBaseline(B, seasonal(), CATEGORIES, {
          currentMonth: "2026-11",
          targetMonth: "2026-12",
          windowMonths: 6,
          seasonality: true,
          minMonthsForSeason: 12,
        });
        expect(out.median).toBe(100); // letzte 6 Monate vor Dezember = je 100
        expect(out.seasonalFactor).toBeGreaterThan(1.3);
        expect(out.seasonalFactor).toBeLessThanOrEqual(2);
        expect(out.baseLimit).toBe(roundSuggestion(100 * out.seasonalFactor));
      });

      it("sollte ohne ausreichende Historie den Faktor neutral (1) lassen", () => {
        const out = computeAdaptiveBaseline(B, spends([["2026-10", 100], ["2026-11", 100]]), CATEGORIES, {
          currentMonth: "2026-11",
          targetMonth: "2026-12",
          seasonality: true,
          minMonthsForSeason: 12,
        });
        expect(out.seasonalFactor).toBe(1);
      });
    });
  });
});
