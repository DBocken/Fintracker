import { describe, expect, it } from "vitest";

import { buildSankeyData, buildWeekdayPattern } from "./analysis-data";
import type { Category, Transaction } from "@/types";

function tx(partial: Partial<Transaction>): Transaction {
  return {
    date: "2026-01-05",
    amount: -10,
    payee: "Test",
    description: "",
    original_text: "",
    auto_mapped: false,
    confirmed: true,
    ...partial,
  };
}

const categories: Category[] = [
  { id: "main-wohnen", name: "Wohnen", filters: [] },
  { id: "sub-miete", name: "Miete", filters: [], parent_id: "main-wohnen" },
  { id: "sub-strom", name: "Strom", filters: [], parent_id: "main-wohnen" },
  { id: "main-mobil", name: "Mobilität", filters: [] },
];

describe("buildSankeyData (Issue #40)", () => {
  it("summiert Einnahmen getrennt von Ausgaben", () => {
    const result = buildSankeyData(
      [tx({ amount: 2500 }), tx({ amount: 300 }), tx({ amount: -800, category_id: "main-wohnen" })],
      categories
    );
    expect(result.totalIncome).toBe(2800);
    expect(result.mainCategories).toHaveLength(1);
    expect(result.mainCategories[0]).toMatchObject({ id: "main-wohnen", amount: 800 });
  });

  it("rollt Unterkategorien zur Hauptkategorie hoch und führt sie separat", () => {
    const result = buildSankeyData(
      [
        tx({ amount: -700, subcategory_id: "sub-miete" }),
        tx({ amount: -100, subcategory_id: "sub-strom" }),
        tx({ amount: -50, category_id: "main-mobil" }),
      ],
      categories
    );
    const wohnen = result.mainCategories.find((m) => m.id === "main-wohnen");
    expect(wohnen?.amount).toBe(800);
    expect(result.subCategories.map((s) => s.id)).toEqual(["sub-miete", "sub-strom"]);
    expect(result.subCategories[0]).toMatchObject({ mainId: "main-wohnen", amount: 700 });
  });

  it("sortiert Hauptkategorien absteigend nach Betrag", () => {
    const result = buildSankeyData(
      [tx({ amount: -50, category_id: "main-wohnen" }), tx({ amount: -200, category_id: "main-mobil" })],
      categories
    );
    expect(result.mainCategories.map((m) => m.id)).toEqual(["main-mobil", "main-wohnen"]);
  });

  it("ordnet Transaktionen ohne Kategorie 'Unkategorisiert' zu", () => {
    const result = buildSankeyData([tx({ amount: -42 })], categories);
    expect(result.mainCategories[0].name).toBe("Unkategorisiert");
    expect(result.mainCategories[0].amount).toBe(42);
  });

  it("behandelt unbekannte Kategorie-IDs wie Unkategorisiert", () => {
    const result = buildSankeyData([tx({ amount: -10, category_id: "gibt-es-nicht" })], categories);
    expect(result.mainCategories[0].name).toBe("Unkategorisiert");
  });

  it("ist robust gegen Zyklen in der Kategorie-Hierarchie", () => {
    const cyclic: Category[] = [
      { id: "a", name: "A", filters: [], parent_id: "b" },
      { id: "b", name: "B", filters: [], parent_id: "a" },
    ];
    const result = buildSankeyData([tx({ amount: -10, category_id: "a" })], cyclic);
    expect(result.mainCategories).toHaveLength(1);
  });

  it("liefert leere Strukturen ohne Transaktionen", () => {
    const result = buildSankeyData([], categories);
    expect(result).toEqual({ totalIncome: 0, mainCategories: [], subCategories: [] });
  });
});

describe("buildWeekdayPattern (Issue #40)", () => {
  it("liefert immer 7 Wochentage in Mo–So-Reihenfolge", () => {
    const result = buildWeekdayPattern([]);
    expect(result.map((e) => e.day)).toEqual(["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]);
  });

  it("bucketiert Einnahmen und Ausgaben auf den richtigen Wochentag", () => {
    // 2026-01-05 ist ein Montag, 2026-01-10 ein Samstag.
    const result = buildWeekdayPattern([
      tx({ date: "2026-01-05", amount: 1000 }),
      tx({ date: "2026-01-05", amount: -200 }),
      tx({ date: "2026-01-10", amount: -50 }),
    ]);
    expect(result[0]).toEqual({ day: "Mo", income: 1000, expenses: 200 });
    expect(result[5]).toEqual({ day: "Sa", income: 0, expenses: 50 });
  });

  it("ignoriert Transaktionen mit unparsebarem Datum", () => {
    const result = buildWeekdayPattern([tx({ date: "kein-datum", amount: -99 })]);
    expect(result.every((e) => e.income === 0 && e.expenses === 0)).toBe(true);
  });
});
