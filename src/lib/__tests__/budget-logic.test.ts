import { describe, it, expect } from "vitest";
import type { Budget, BudgetRule, Category, Transaction, TransactionAllocation } from "@/types";
import { asTransactionId } from "@/lib/ids";
import {
  DEFAULT_WARN_THRESHOLD,
  budgetCategoryIds,
  computeBudgetSpent,
  computeBudgetStatus,
  healthFor,
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
        const txs = [tx({ id: asTransactionId("t1"), date: "2026-06-01", amount: -100, category_id: "freizeit" })];
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

    it("sollte bei Verbrauch exakt am Limit warn melden, nicht over", () => {
      // Die Grenze selbst (`spent > limit`, budget-logic.ts). Sie speist die
      // Budget-Ampeln UND den virtuellen Tank in disposable-budget.ts — bis
      // WP 2.1 pruefte die Suite nur klar drunter und klar drueber, eine
      // Mutation von `>` zu `>=` waere an beiden Stellen gruen geblieben.
      // Fachlich gilt: das Limit ist ausgeschoepft, nicht ueberschritten.
      const exact = [tx({ date: "2026-06-01", amount: -1000, category_id: "miete" })];
      const s = computeBudgetStatus(
        budget({ id: "b", category_id: "wohnen", limit: 1000, warn_threshold: 90 }),
        exact,
        CATEGORIES,
        "2026-06",
      );
      expect(s.spent).toBe(1000);
      expect(s.remaining).toBe(0);
      expect(s.health).toBe("warn");
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

    it("sollte payee/description bei equals exakt vergleichen und fehlenden Text als leer behandeln", () => {
      // Ein Budget mit `equals`-Regel begrenzt genau EINEN Zahlungsempfänger.
      // Träfe `equals` wie `contains`, zöge dasselbe Limit fremde Ausgaben mit.
      const genau = tx({ date: "2026-06-01", amount: -10, payee: "Netflix" });
      expect(transactionMatchesRules([{ field: "payee", op: "equals", value: "netflix" }], genau)).toBe(true);
      expect(transactionMatchesRules([{ field: "payee", op: "equals", value: "netflix gmbh" }], genau)).toBe(false);

      const ohneText = tx({ date: "2026-06-01", amount: -10 });
      delete (ohneText as Partial<Transaction>).payee;
      expect(transactionMatchesRules([{ field: "payee", op: "equals", value: "netflix" }], ohneText)).toBe(false);
      expect(transactionMatchesRules([{ field: "description", op: "contains", value: "abo" }], ohneText)).toBe(false);
    });

    it("sollte Konto-Regeln über die Konto-ID prüfen (equals und contains)", () => {
      const t = tx({ date: "2026-06-01", amount: -10, account_id: "giro-haupt" });
      expect(transactionMatchesRules([{ field: "account", op: "equals", value: "giro-haupt" }], t)).toBe(true);
      expect(transactionMatchesRules([{ field: "account", op: "equals", value: "giro" }], t)).toBe(false);
      expect(transactionMatchesRules([{ field: "account", op: "contains", value: "giro" }], t)).toBe(true);

      const ohneKonto = tx({ date: "2026-06-01", amount: -10 });
      expect(transactionMatchesRules([{ field: "account", op: "equals", value: "giro-haupt" }], ohneKonto)).toBe(false);
      expect(transactionMatchesRules([{ field: "account", op: "contains", value: "giro" }], ohneKonto)).toBe(false);
    });

    it("sollte eine Betragsregel mit unlesbarem Schwellwert nicht als Filter wirken lassen", () => {
      // Eine kaputte Schwelle darf das Budget nicht heimlich leeren: Statt „nichts
      // passt" (Verbrauch fällt auf 0 und die Ampel steht auf Grün) gilt die
      // Regel als nicht einschränkend.
      const t = tx({ date: "2026-06-01", amount: -50 });
      expect(transactionMatchesRules([{ field: "amount", op: "gt", value: "" }], t)).toBe(true);
      expect(transactionMatchesRules([{ field: "amount", op: "gt", value: "abc" }], t)).toBe(true);
    });

    it("sollte eine Betragsregel mit equals auf den Absolutbetrag anwenden", () => {
      const t = tx({ date: "2026-06-01", amount: -50 });
      expect(transactionMatchesRules([{ field: "amount", op: "equals", value: "50" }], t)).toBe(true);
      expect(transactionMatchesRules([{ field: "amount", op: "equals", value: "-50" }], t)).toBe(false);
    });

    it("sollte ein unbekanntes Regelfeld ignorieren statt alles auszuschließen", () => {
      // Ein Feld aus einer neueren Version darf ein Budget in einer älteren
      // Installation nicht auf 0 € Verbrauch einfrieren.
      const t = tx({ date: "2026-06-01", amount: -50 });
      const unbekannt = [{ field: "zukunftsfeld", op: "equals", value: "x" }] as unknown as BudgetRule[];
      expect(transactionMatchesRules(unbekannt, t)).toBe(true);
    });
  });

  describe("computeBudgetSpent mit Match-Regeln", () => {
    it("sollte Buchungen der richtigen Kategorie zählen, die die Regel NICHT erfüllen, auslassen", () => {
      const txs = [
        tx({ date: "2026-06-01", amount: -800, category_id: "miete", payee: "Vermieter" }),
        tx({ date: "2026-06-02", amount: -120, category_id: "strom", payee: "Stadtwerke" }),
      ];
      const b = budget({
        id: "b",
        category_id: "wohnen",
        limit: 1000,
        rules: [{ field: "payee", op: "contains", value: "stadtwerke" }],
      });
      expect(computeBudgetSpent(b, txs, CATEGORIES, "2026-06")).toBe(120);
    });
  });

  describe("healthFor (eine Quelle der Wahrheit für die Ampel)", () => {
    it("sollte ohne Limit nur dann over melden, wenn überhaupt etwas ausgegeben wurde", () => {
      // Ein Budget mit Limit 0 („darf nichts kosten") ist bei 0 € Verbrauch
      // eingehalten — die Ampel muss grün bleiben, sonst steht ein frisch
      // angelegtes Nullbudget sofort auf Rot.
      expect(healthFor(0, 0, DEFAULT_WARN_THRESHOLD)).toBe("ok");
      expect(healthFor(0.01, 0, DEFAULT_WARN_THRESHOLD)).toBe("over");
      expect(healthFor(0, -50, DEFAULT_WARN_THRESHOLD)).toBe("ok");
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

      it("sollte ohne windowMonths über drei Monate mitteln", () => {
        // Der Divisor bestimmt die vorgeschlagene Grenze direkt. Ein
        // versehentlich anderer Standardwert verschiebt jeden Vorschlag um
        // denselben Faktor — hier festgenagelt: 900 € in einem von drei
        // Fenstermonaten ergeben 300 € Durchschnitt, nicht 900 €.
        const out = suggestBudgets(CATEGORIES, [tx({ date: "2026-06-01", amount: -900, category_id: "miete" })], {
          currentMonth: "2026-06",
        });
        expect(out).toHaveLength(1);
        expect(out[0].avgMonthly).toBeCloseTo(300);
      });

      it("sollte das Fenster über die Jahresgrenze zurückzählen", () => {
        // Januar minus drei Monate endet im Vorjahr. Rechnet die Fensterbildung
        // hier falsch, verschwinden November und Dezember aus dem Durchschnitt
        // und der Vorschlag fällt für jeden Januar-Nutzer zu niedrig aus.
        const txs = [
          tx({ date: "2026-01-10", amount: -300, category_id: "miete" }),
          tx({ date: "2025-12-10", amount: -300, category_id: "miete" }),
          tx({ date: "2025-11-10", amount: -300, category_id: "miete" }),
          tx({ date: "2025-10-10", amount: -900, category_id: "miete" }), // außerhalb des Fensters
        ];
        const out = suggestBudgets(CATEGORIES, txs, { currentMonth: "2026-01", windowMonths: 3 });
        expect(out).toHaveLength(1);
        expect(out[0].avgMonthly).toBeCloseTo(300);
      });

      it("sollte Überträge und Buchungen außerhalb des Fensters nicht mitmitteln", () => {
        const txs = [
          tx({ date: "2026-06-01", amount: -300, category_id: "miete" }),
          tx({ date: "2026-06-02", amount: -9000, category_id: "miete", is_transfer: true }),
          tx({ date: "2026-01-02", amount: -9000, category_id: "miete" }),
        ];
        const out = suggestBudgets(CATEGORIES, txs, { currentMonth: "2026-06", windowMonths: 3 });
        expect(out).toHaveLength(1);
        expect(out[0].avgMonthly).toBeCloseTo(100);
      });

      it("sollte Ausgaben ohne auflösbare Kategorie keinem Vorschlag zuschlagen", () => {
        // Unkategorisiert, gelöschte Kategorie und Unterkategorie mit
        // verwaister parent_id: keiner dieser Beträge darf in einem fremden
        // Budgetvorschlag auftauchen — sonst schlägt die App eine Grenze für
        // Geld vor, das dort nie ausgegeben wurde.
        const catsMitWaise: Category[] = [
          ...CATEGORIES,
          cat({ id: "waise", name: "Waise", parent_id: "geloescht" }),
        ];
        const txs = [
          tx({ date: "2026-06-01", amount: -500 }), // ohne Kategorie
          tx({ date: "2026-06-02", amount: -500, category_id: "gibtsnicht" }), // gelöschte Kategorie
          tx({ date: "2026-06-03", amount: -500, category_id: "waise" }), // Elternteil gelöscht
        ];
        const out = suggestBudgets(catsMitWaise, txs, { currentMonth: "2026-06", windowMonths: 1 });
        expect(out).toHaveLength(0);
      });
    });
  });
});
