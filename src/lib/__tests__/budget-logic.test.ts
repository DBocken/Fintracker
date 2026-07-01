import { describe, it, expect } from "vitest";
import type { Budget, Category, Transaction, TransactionAllocation } from "@/types";
import {
  budgetCategoryIds,
  computeBudgetSpent,
  computeBudgetStatus,
  monthKeyOf,
  periodKeyOf,
  roundSuggestion,
  suggestBudgets,
  transactionMatchesRules,
} from "@/lib/budget-logic";

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

// Beispiel-Hierarchie: Wohnen (main) → Miete, Strom (subs)
const CATEGORIES: Category[] = [
  cat({ id: "wohnen", name: "Wohnen", attributes: { ausgabenklasse: "essenziell" } }),
  cat({ id: "miete", name: "Miete", parent_id: "wohnen" }),
  cat({ id: "strom", name: "Strom", parent_id: "wohnen" }),
  cat({ id: "freizeit", name: "Freizeit", attributes: { ausgabenklasse: "diskretionaer" } }),
  cat({ id: "kino", name: "Kino", parent_id: "freizeit" }),
  cat({ id: "gehalt", name: "Gehalt", attributes: { ausgabenklasse: "einkommen" } }),
];

describe("budget-logic", () => {
  describe("monthKeyOf", () => {
    it("sollte YYYY-MM aus ISO-Datum extrahieren", () => {
      expect(monthKeyOf("2026-06-15")).toBe("2026-06");
    });
    it("sollte mit leerem/undefiniertem Datum umgehen", () => {
      expect(monthKeyOf("")).toBe("");
      expect(monthKeyOf(undefined)).toBe("");
      expect(monthKeyOf(null)).toBe("");
    });
  });

  describe("periodKeyOf (#133 flexible Perioden)", () => {
    it("sollte ohne Periode wie monthKeyOf einen Monatsschlüssel liefern (abwärtskompatibel)", () => {
      expect(periodKeyOf("2026-06-15")).toBe("2026-06");
      expect(periodKeyOf("2026-06-15", "monthly")).toBe(monthKeyOf("2026-06-15"));
    });

    it("sollte jährlich auf YYYY reduzieren", () => {
      expect(periodKeyOf("2026-06-15", "yearly")).toBe("2026");
      expect(periodKeyOf("2026-12-31", "yearly")).toBe("2026");
    });

    it("sollte wöchentlich einen ISO-Wochenschlüssel liefern (Woche beginnt Montag)", () => {
      // 2026-06-15 ist ein Montag → Beginn seiner ISO-Woche.
      expect(periodKeyOf("2026-06-15", "weekly")).toBe(periodKeyOf("2026-06-21", "weekly"));
      // 2026-06-22 (Folgemontag) liegt in einer anderen Woche.
      expect(periodKeyOf("2026-06-15", "weekly")).not.toBe(periodKeyOf("2026-06-22", "weekly"));
    });

    it("[Edge] sollte die ISO-Woche über die Jahresgrenze korrekt zählen", () => {
      // 2025-12-29 (Mo) und 2026-01-01 (Do) liegen in derselben ISO-Woche 2026-W01.
      expect(periodKeyOf("2025-12-29", "weekly")).toBe("2026-W01");
      expect(periodKeyOf("2026-01-01", "weekly")).toBe("2026-W01");
    });

    it("[Edge] sollte mit leerem/unparsbarem Datum leer zurückgeben", () => {
      expect(periodKeyOf("", "weekly")).toBe("");
      expect(periodKeyOf(null, "yearly")).toBe("");
      expect(periodKeyOf("kein-datum", "weekly")).toBe("");
    });
  });

  describe("budgetCategoryIds", () => {
    it("sollte Haupt- + alle Unterkategorien enthalten, wenn keine Auswahl", () => {
      const ids = budgetCategoryIds(budget({ id: "b", category_id: "wohnen", limit: 1000 }), CATEGORIES);
      expect(ids).toEqual(new Set(["wohnen", "miete", "strom"]));
    });
    it("sollte nur ausgewählte Unterkategorien enthalten", () => {
      const ids = budgetCategoryIds(
        budget({ id: "b", category_id: "wohnen", limit: 1000, subcategory_ids: ["miete"] }),
        CATEGORIES,
      );
      expect(ids).toEqual(new Set(["miete"]));
    });

    describe("Edge Cases", () => {
      it("sollte mit Hauptkategorie ohne Kinder umgehen", () => {
        const ids = budgetCategoryIds(budget({ id: "b", category_id: "leer", limit: 10 }), CATEGORIES);
        expect(ids).toEqual(new Set(["leer"]));
      });
    });
  });

  describe("computeBudgetSpent", () => {
    it("sollte Ausgaben der Haupt- und Unterkategorien im Monat summieren", () => {
      const txs = [
        tx({ date: "2026-06-01", amount: -800, category_id: "miete" }),
        tx({ date: "2026-06-05", amount: -120, category_id: "strom" }),
        tx({ date: "2026-06-10", amount: -50, category_id: "wohnen" }),
      ];
      const spent = computeBudgetSpent(
        budget({ id: "b", category_id: "wohnen", limit: 1000 }),
        txs,
        CATEGORIES,
        "2026-06",
      );
      expect(spent).toBe(970);
    });

    it("sollte nur Ausgaben des Zielmonats zählen", () => {
      const txs = [
        tx({ date: "2026-06-01", amount: -800, category_id: "miete" }),
        tx({ date: "2026-05-01", amount: -800, category_id: "miete" }),
      ];
      expect(
        computeBudgetSpent(budget({ id: "b", category_id: "wohnen", limit: 1000 }), txs, CATEGORIES, "2026-06"),
      ).toBe(800);
    });

    it("sollte fremde Kategorien ignorieren", () => {
      const txs = [tx({ date: "2026-06-01", amount: -90, category_id: "kino" })];
      expect(
        computeBudgetSpent(budget({ id: "b", category_id: "wohnen", limit: 1000 }), txs, CATEGORIES, "2026-06"),
      ).toBe(0);
    });

    describe("flexible Perioden (#133)", () => {
      it("sollte bei jährlicher Periode alle Monate des Jahres summieren", () => {
        const txs = [
          tx({ date: "2026-01-15", amount: -100, category_id: "miete" }),
          tx({ date: "2026-07-15", amount: -200, category_id: "strom" }),
          tx({ date: "2025-12-15", amount: -999, category_id: "miete" }), // Vorjahr zählt nicht
        ];
        const spent = computeBudgetSpent(
          budget({ id: "b", category_id: "wohnen", limit: 5000, period: "yearly" }),
          txs,
          CATEGORIES,
          "2026",
        );
        expect(spent).toBe(300);
      });

      it("sollte bei wöchentlicher Periode nur die Ziel-ISO-Woche zählen", () => {
        const weekKey = periodKeyOf("2026-06-15", "weekly"); // Mo 15.06.
        const txs = [
          tx({ date: "2026-06-15", amount: -30, category_id: "miete" }), // Mo, Zielwoche
          tx({ date: "2026-06-21", amount: -20, category_id: "strom" }), // So, Zielwoche
          tx({ date: "2026-06-22", amount: -999, category_id: "miete" }), // Folgewoche
        ];
        const spent = computeBudgetSpent(
          budget({ id: "b", category_id: "wohnen", limit: 100, period: "weekly" }),
          txs,
          CATEGORIES,
          weekKey,
        );
        expect(spent).toBe(50);
      });
    });

    describe("Edge Cases", () => {
      it("sollte Transfers nicht als Ausgabe zählen", () => {
        const txs = [tx({ date: "2026-06-01", amount: -800, category_id: "miete", is_transfer: true })];
        expect(
          computeBudgetSpent(budget({ id: "b", category_id: "wohnen", limit: 1000 }), txs, CATEGORIES, "2026-06"),
        ).toBe(0);
      });

      it("sollte positive Beiträge (Erstattungen) nicht als Ausgabe zählen", () => {
        const txs = [
          tx({ date: "2026-06-01", amount: -100, category_id: "strom" }),
          tx({ date: "2026-06-02", amount: 30, category_id: "strom" }),
        ];
        expect(
          computeBudgetSpent(budget({ id: "b", category_id: "wohnen", limit: 1000 }), txs, CATEGORIES, "2026-06"),
        ).toBe(100);
      });

      it("sollte nur ausgewählte Unterkategorien zählen", () => {
        const txs = [
          tx({ date: "2026-06-01", amount: -800, category_id: "miete" }),
          tx({ date: "2026-06-01", amount: -120, category_id: "strom" }),
        ];
        const b = budget({ id: "b", category_id: "wohnen", limit: 1000, subcategory_ids: ["strom"] });
        expect(computeBudgetSpent(b, txs, CATEGORIES, "2026-06")).toBe(120);
      });

      it("sollte Split-Aufteilungen anteilig berücksichtigen", () => {
        const txs = [tx({ id: "t1", date: "2026-06-01", amount: -100, category_id: "freizeit" })];
        const allocations = new Map<string, TransactionAllocation[]>([
          [
            "t1",
            [
              { id: "a1", transaction_id: "t1", category_id: null, subcategory_id: "miete", amount_minor: -7000, source: "manual" },
              { id: "a2", transaction_id: "t1", category_id: null, subcategory_id: "kino", amount_minor: -3000, source: "manual" },
            ] as TransactionAllocation[],
          ],
        ]);
        const spent = computeBudgetSpent(
          budget({ id: "b", category_id: "wohnen", limit: 1000 }),
          txs,
          CATEGORIES,
          "2026-06",
          allocations,
        );
        expect(spent).toBe(70);
      });
    });
  });

  describe("computeBudgetStatus", () => {
    const txs = [tx({ date: "2026-06-01", amount: -850, category_id: "miete" })];

    it("sollte ok melden, wenn unter der Warnschwelle", () => {
      const s = computeBudgetStatus(
        budget({ id: "b", category_id: "wohnen", limit: 1000, warn_threshold: 90 }),
        txs,
        CATEGORIES,
        "2026-06",
      );
      expect(s.spent).toBe(850);
      expect(s.remaining).toBe(150);
      expect(s.fillPercent).toBe(85);
      expect(s.health).toBe("ok");
    });

    it("sollte warn melden, wenn die Warnschwelle erreicht ist", () => {
      const s = computeBudgetStatus(
        budget({ id: "b", category_id: "wohnen", limit: 1000, warn_threshold: 80 }),
        txs,
        CATEGORIES,
        "2026-06",
      );
      expect(s.health).toBe("warn");
    });

    it("sollte over melden und fillPercent bei 100 kappen", () => {
      const over = [tx({ date: "2026-06-01", amount: -1200, category_id: "miete" })];
      const s = computeBudgetStatus(
        budget({ id: "b", category_id: "wohnen", limit: 1000 }),
        over,
        CATEGORIES,
        "2026-06",
      );
      expect(s.health).toBe("over");
      expect(s.remaining).toBe(-200);
      expect(s.fillPercent).toBe(100);
      expect(s.ratio).toBeCloseTo(1.2);
    });

    describe("Edge Cases", () => {
      it("sollte mit Limit 0 nicht durch Null teilen", () => {
        const s = computeBudgetStatus(budget({ id: "b", category_id: "wohnen", limit: 0 }), txs, CATEGORIES, "2026-06");
        expect(s.ratio).toBe(0);
        expect(s.fillPercent).toBe(0);
        expect(s.health).toBe("over"); // Ausgaben > 0 bei Limit 0
      });
    });
  });

  describe("transactionMatchesRules", () => {
    it("sollte ohne Regeln immer true sein", () => {
      expect(transactionMatchesRules(undefined, tx({ date: "2026-06-01", amount: -10 }))).toBe(true);
      expect(transactionMatchesRules([], tx({ date: "2026-06-01", amount: -10 }))).toBe(true);
    });
    it("sollte payee contains prüfen (case-insensitive)", () => {
      const t = tx({ date: "2026-06-01", amount: -10, payee: "Netflix GmbH" });
      expect(transactionMatchesRules([{ field: "payee", op: "contains", value: "netflix" }], t)).toBe(true);
      expect(transactionMatchesRules([{ field: "payee", op: "contains", value: "spotify" }], t)).toBe(false);
    });
    it("sollte Betragsschwellen prüfen (absoluter Betrag)", () => {
      const t = tx({ date: "2026-06-01", amount: -50 });
      expect(transactionMatchesRules([{ field: "amount", op: "gt", value: "40" }], t)).toBe(true);
      expect(transactionMatchesRules([{ field: "amount", op: "lt", value: "40" }], t)).toBe(false);
    });
    it("sollte alle Regeln per UND verknüpfen", () => {
      const t = tx({ date: "2026-06-01", amount: -50, payee: "Edeka" });
      expect(
        transactionMatchesRules(
          [
            { field: "payee", op: "contains", value: "edeka" },
            { field: "amount", op: "gt", value: "100" },
          ],
          t,
        ),
      ).toBe(false);
    });
  });

  describe("roundSuggestion", () => {
    it("sollte mit 5% Puffer auf die nächste 10er-Stufe aufrunden", () => {
      expect(roundSuggestion(812)).toBe(860); // 812*1.05=852.6 → 860
      expect(roundSuggestion(0)).toBe(10);
      expect(roundSuggestion(95)).toBe(100);
    });
  });

  describe("suggestBudgets", () => {
    const txs = [
      // Juni
      tx({ date: "2026-06-01", amount: -800, category_id: "miete" }),
      tx({ date: "2026-06-05", amount: -90, category_id: "kino" }),
      tx({ date: "2026-06-07", amount: 3000, category_id: "gehalt" }),
      // Mai
      tx({ date: "2026-05-01", amount: -820, category_id: "miete" }),
      // April
      tx({ date: "2026-04-01", amount: -780, category_id: "miete" }),
    ];

    it("sollte Vorschläge nach Durchschnitt sortiert liefern", () => {
      const out = suggestBudgets(CATEGORIES, txs, { currentMonth: "2026-06", windowMonths: 3 });
      expect(out[0].category_id).toBe("wohnen");
      // (800+820+780)/3 = 800
      expect(out[0].avgMonthly).toBeCloseTo(800);
      expect(out[0].limit).toBe(roundSuggestion(800));
    });

    it("sollte Einnahmen-Kategorien ausschließen", () => {
      const out = suggestBudgets(CATEGORIES, txs, { currentMonth: "2026-06", windowMonths: 3 });
      expect(out.some((s) => s.category_id === "gehalt")).toBe(false);
    });

    it("sollte bereits budgetierte Kategorien ausschließen", () => {
      const out = suggestBudgets(CATEGORIES, txs, {
        currentMonth: "2026-06",
        windowMonths: 3,
        excludeCategoryIds: new Set(["wohnen"]),
      });
      expect(out.some((s) => s.category_id === "wohnen")).toBe(false);
    });

    describe("Edge Cases", () => {
      it("sollte Bagatellbeträge unter minAvg auslassen", () => {
        const small = [tx({ date: "2026-06-01", amount: -3, category_id: "kino" })];
        const out = suggestBudgets(CATEGORIES, small, { currentMonth: "2026-06", windowMonths: 3, minAvg: 5 });
        expect(out).toHaveLength(0);
      });

      it("[REGRESSION] sollte Unterkategorie-Ausgaben der Hauptkategorie zuordnen", () => {
        const onlySub = [tx({ date: "2026-06-01", amount: -300, category_id: "kino" })];
        const out = suggestBudgets(CATEGORIES, onlySub, { currentMonth: "2026-06", windowMonths: 1 });
        expect(out).toHaveLength(1);
        expect(out[0].category_id).toBe("freizeit");
        expect(out[0].avgMonthly).toBeCloseTo(300);
      });
    });
  });
});
