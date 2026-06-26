import { describe, it, expect } from "vitest";
import type { Budget, Category, Transaction } from "@/types";
import {
  resolveRolloverConfig,
  computeCarryOut,
  computeRolloverLedger,
  computeBudgetStatusWithRollover,
} from "@/lib/budget-rollover";

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

// Hilfsfunktion: eine Ausgabe in „Miete" (zählt für ein Wohnen-Budget) im Monat.
const spend = (month: string, amount: number) => tx({ date: `${month}-15`, amount: -amount, category_id: "miete" });

describe("budget-rollover", () => {
  describe("resolveRolloverConfig (Migration)", () => {
    it("sollte eine vorhandene rolloverConfig unverändert zurückgeben", () => {
      const cfg = { mode: "overspend" as const, cap: 100 };
      expect(resolveRolloverConfig(budget({ id: "b", category_id: "wohnen", limit: 1000, rolloverConfig: cfg }))).toBe(cfg);
    });

    it("[REGRESSION] sollte das alte boolean-Feld rollover:true auf 'accumulate' migrieren", () => {
      const cfg = resolveRolloverConfig(budget({ id: "b", category_id: "wohnen", limit: 1000, rollover: true }));
      expect(cfg.mode).toBe("accumulate");
    });

    it("sollte ohne jede Angabe 'off' liefern", () => {
      expect(resolveRolloverConfig(budget({ id: "b", category_id: "wohnen", limit: 1000 })).mode).toBe("off");
    });
  });

  describe("computeCarryOut", () => {
    it("sollte bei 'off' immer 0 liefern", () => {
      expect(computeCarryOut("off", 300)).toBe(0);
      expect(computeCarryOut("off", -300)).toBe(0);
    });

    it("sollte bei 'accumulate' nur positiven Rest übertragen", () => {
      expect(computeCarryOut("accumulate", 300)).toBe(300);
      expect(computeCarryOut("accumulate", -300)).toBe(0);
    });

    it("sollte bei 'overspend' nur negativen Rest (Überzug) übertragen", () => {
      expect(computeCarryOut("overspend", -200)).toBe(-200);
      expect(computeCarryOut("overspend", 200)).toBe(0);
    });

    it("sollte bei 'both' positiven und negativen Rest übertragen", () => {
      expect(computeCarryOut("both", 200)).toBe(200);
      expect(computeCarryOut("both", -200)).toBe(-200);
    });

    describe("Cap", () => {
      it("sollte den positiven Übertrag bei cap deckeln", () => {
        expect(computeCarryOut("accumulate", 500, 350)).toBe(350);
        expect(computeCarryOut("both", 500, 350)).toBe(350);
      });
      it("sollte einen negativen Übertrag vom Cap unberührt lassen", () => {
        expect(computeCarryOut("both", -500, 350)).toBe(-500);
      });
      it("sollte cap=0/undefined als unbegrenzt behandeln", () => {
        expect(computeCarryOut("accumulate", 500, 0)).toBe(500);
        expect(computeCarryOut("accumulate", 500)).toBe(500);
      });
    });
  });

  describe("computeRolloverLedger", () => {
    it("sollte bei 'accumulate' ungenutztes Budget kumulieren", () => {
      const b = budget({ id: "b", category_id: "wohnen", limit: 1000, rolloverConfig: { mode: "accumulate" } });
      const txs = [spend("2026-04", 700), spend("2026-05", 900)];
      const led = computeRolloverLedger(b, txs, CATEGORIES, ["2026-04", "2026-05"]);

      expect(led[0]).toMatchObject({ carryIn: 0, effectiveLimit: 1000, spent: 700, remaining: 300, carryOut: 300 });
      expect(led[1]).toMatchObject({ carryIn: 300, effectiveLimit: 1300, spent: 900, remaining: 400, carryOut: 400 });
    });

    it("sollte bei 'overspend' eine Überschreitung in den Folgemonat ziehen (Start im Minus)", () => {
      const b = budget({ id: "b", category_id: "wohnen", limit: 1000, rolloverConfig: { mode: "overspend" } });
      const txs = [spend("2026-04", 1200), spend("2026-05", 500)];
      const led = computeRolloverLedger(b, txs, CATEGORIES, ["2026-04", "2026-05"]);

      expect(led[0]).toMatchObject({ carryIn: 0, effectiveLimit: 1000, spent: 1200, remaining: -200, carryOut: -200 });
      // Folgemonat startet bei 1000 - 200 = 800; positiver Rest wird im overspend-Modus nicht weitergereicht.
      expect(led[1]).toMatchObject({ carryIn: -200, effectiveLimit: 800, spent: 500, remaining: 300, carryOut: 0 });
    });

    it("sollte bei 'both' positiven und negativen Übertrag verketten", () => {
      const b = budget({ id: "b", category_id: "wohnen", limit: 1000, rolloverConfig: { mode: "both" } });
      const txs = [spend("2026-04", 1200), spend("2026-05", 500)];
      const led = computeRolloverLedger(b, txs, CATEGORIES, ["2026-04", "2026-05"]);

      expect(led[1]).toMatchObject({ carryIn: -200, effectiveLimit: 800, remaining: 300, carryOut: 300 });
    });

    it("sollte den Cap über die Kette hinweg anwenden", () => {
      const b = budget({ id: "b", category_id: "wohnen", limit: 1000, rolloverConfig: { mode: "accumulate", cap: 350 } });
      const txs = [spend("2026-04", 700), spend("2026-05", 900)];
      const led = computeRolloverLedger(b, txs, CATEGORIES, ["2026-04", "2026-05"]);

      expect(led[0].carryOut).toBe(300);
      // Roh wäre 400, gedeckelt auf 350.
      expect(led[1].carryOut).toBe(350);
    });

    it("sollte positiven Überschuss bei surplusAction='sweep_savings' abführen statt übertragen", () => {
      const b = budget({
        id: "b",
        category_id: "wohnen",
        limit: 1000,
        rolloverConfig: { mode: "accumulate", surplusAction: "sweep_savings" },
      });
      const txs = [spend("2026-04", 700), spend("2026-05", 900)];
      const led = computeRolloverLedger(b, txs, CATEGORIES, ["2026-04", "2026-05"]);

      expect(led[0]).toMatchObject({ remaining: 300, swept: 300, carryOut: 0 });
      expect(led[1].carryIn).toBe(0); // nichts kumuliert, da abgeführt
    });

    describe("Optionen", () => {
      it("sollte initialCarryIn für den ersten Monat berücksichtigen", () => {
        const b = budget({ id: "b", category_id: "wohnen", limit: 1000, rolloverConfig: { mode: "accumulate" } });
        const led = computeRolloverLedger(b, [spend("2026-04", 500)], CATEGORIES, ["2026-04"], undefined, {
          initialCarryIn: 200,
        });
        expect(led[0]).toMatchObject({ carryIn: 200, effectiveLimit: 1200, remaining: 700 });
      });

      it("sollte ein datengetriebenes Basislimit via baseLimitFor erlauben", () => {
        const b = budget({ id: "b", category_id: "wohnen", limit: 1000, rolloverConfig: { mode: "accumulate" } });
        const led = computeRolloverLedger(b, [spend("2026-04", 500)], CATEGORIES, ["2026-04"], undefined, {
          baseLimitFor: () => 600,
        });
        expect(led[0]).toMatchObject({ baseLimit: 600, effectiveLimit: 600, remaining: 100 });
      });
    });

    describe("Edge Cases", () => {
      it("sollte bei mode 'off' nie etwas übertragen", () => {
        const b = budget({ id: "b", category_id: "wohnen", limit: 1000 });
        const txs = [spend("2026-04", 700), spend("2026-05", 900)];
        const led = computeRolloverLedger(b, txs, CATEGORIES, ["2026-04", "2026-05"]);
        expect(led[0].carryOut).toBe(0);
        expect(led[1].carryIn).toBe(0);
        expect(led[1].effectiveLimit).toBe(1000);
      });
    });
  });

  describe("computeBudgetStatusWithRollover", () => {
    it("sollte bei 'accumulate' trotz Ausgaben über Basislimit 'ok' bleiben (effektives Limit zählt)", () => {
      const b = budget({ id: "b", category_id: "wohnen", limit: 1000, warn_threshold: 90, rolloverConfig: { mode: "accumulate" } });
      // Vormonat spart 300 an → effektiv 1300; aktueller Monat gibt 1100 aus (> Basis, < effektiv).
      const txs = [spend("2026-04", 700), spend("2026-05", 1100)];
      const s = computeBudgetStatusWithRollover(b, txs, CATEGORIES, ["2026-04", "2026-05"]);

      expect(s.carryIn).toBe(300);
      expect(s.effectiveLimit).toBe(1300);
      expect(s.spent).toBe(1100);
      expect(s.remaining).toBe(200);
      expect(s.health).toBe("ok");
      expect(s.fillPercent).toBeCloseTo((1100 / 1300) * 100);
    });

    it("sollte bei 'overspend' das reduzierte Limit für den Status nutzen", () => {
      const b = budget({ id: "b", category_id: "wohnen", limit: 1000, rolloverConfig: { mode: "overspend" } });
      const txs = [spend("2026-04", 1200), spend("2026-05", 900)];
      const s = computeBudgetStatusWithRollover(b, txs, CATEGORIES, ["2026-04", "2026-05"]);

      expect(s.carryIn).toBe(-200);
      expect(s.effectiveLimit).toBe(800);
      expect(s.spent).toBe(900);
      expect(s.remaining).toBe(-100);
      expect(s.health).toBe("over");
    });
  });
});
