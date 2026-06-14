import { describe, expect, it } from "vitest";

import {
  buildSankeyData,
  buildSpendingSunburst,
  buildWeekdayPattern,
  resolveAusgabenklasse,
} from "./analysis-data";
import type { Account, Category, Transaction } from "@/types";

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

function acc(partial: Partial<Account>): Account {
  return {
    id: "acc-default",
    user_id: "user-1",
    name: "Konto",
    type: "checking",
    currency: "EUR",
    color: "#3b82f6",
    icon: "bank",
    is_budget_pool_member: true,
    order_index: 0,
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
    expect(result).toEqual({ totalIncome: 0, accounts: [], mainCategories: [], subCategories: [] });
  });
});

describe("buildSankeyData – Konten (Variante 1: Netto je Konto)", () => {
  const giro = acc({ id: "acc-giro", name: "Girokonto", color: "#3b82f6" });
  const spar = acc({ id: "acc-spar", name: "Sparkonto", color: "#22c55e" });

  it("berechnet Einnahmen, Ausgaben und Netto je Konto", () => {
    const result = buildSankeyData(
      [
        tx({ amount: 2000, account_id: "acc-giro" }),
        tx({ amount: -500, account_id: "acc-giro", category_id: "main-wohnen" }),
        tx({ amount: 100, account_id: "acc-spar" }),
      ],
      categories,
      [giro, spar]
    );

    const giroNode = result.accounts.find((a) => a.id === "acc-giro");
    const sparNode = result.accounts.find((a) => a.id === "acc-spar");

    expect(giroNode).toMatchObject({ name: "Girokonto", income: 2000, expenses: 500, net: 1500, color: "#3b82f6" });
    expect(sparNode).toMatchObject({ name: "Sparkonto", income: 100, expenses: 0, net: 100, color: "#22c55e" });
  });

  it("schlüsselt Ausgaben je Hauptkategorie nach Konto auf", () => {
    const result = buildSankeyData(
      [
        tx({ amount: -300, account_id: "acc-giro", category_id: "main-wohnen" }),
        tx({ amount: -200, account_id: "acc-spar", category_id: "main-wohnen" }),
      ],
      categories,
      [giro, spar]
    );

    const wohnen = result.mainCategories.find((m) => m.id === "main-wohnen");
    expect(wohnen?.byAccount).toEqual({ "acc-giro": 300, "acc-spar": 200 });
  });

  it("ordnet Transaktionen ohne Konto-Zuordnung 'Sonstiges Konto' zu", () => {
    const result = buildSankeyData([tx({ amount: -50, category_id: "main-wohnen" })], categories, [giro]);
    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0]).toMatchObject({ name: "Sonstiges Konto", expenses: 50 });
  });

  it("ignoriert Konten ohne Einnahmen oder Ausgaben", () => {
    const result = buildSankeyData(
      [tx({ amount: -50, account_id: "acc-giro", category_id: "main-wohnen" })],
      categories,
      [giro, spar]
    );
    expect(result.accounts.map((a) => a.id)).toEqual(["acc-giro"]);
  });

  it("sortiert Konten absteigend nach Gesamtaktivität (Einnahmen + Ausgaben)", () => {
    const result = buildSankeyData(
      [
        tx({ amount: -50, account_id: "acc-spar", category_id: "main-wohnen" }),
        tx({ amount: 2000, account_id: "acc-giro" }),
        tx({ amount: -500, account_id: "acc-giro", category_id: "main-wohnen" }),
      ],
      categories,
      [giro, spar]
    );
    expect(result.accounts.map((a) => a.id)).toEqual(["acc-giro", "acc-spar"]);
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

describe("buildSpendingSunburst (Superkategorie -> Hauptkategorie)", () => {
  const klassCats: Category[] = [
    { id: "wohnen", name: "Wohnen", filters: [], attributes: { ausgabenklasse: "essenziell" } },
    { id: "miete", name: "Miete", filters: [], parent_id: "wohnen", attributes: { ausgabenklasse: "essenziell" } },
    { id: "mobil", name: "Mobilität", filters: [], attributes: { ausgabenklasse: "diskretionaer" } },
    { id: "kraftstoff", name: "Kraftstoff", filters: [], parent_id: "mobil", attributes: { ausgabenklasse: "essenziell" } },
    { id: "parken", name: "Parken", filters: [], parent_id: "mobil", attributes: { ausgabenklasse: "diskretionaer" } },
    { id: "sparen", name: "Sparen & Investieren", filters: [], attributes: { ausgabenklasse: "sparen" } },
  ];

  it("gruppiert Ausgaben nach Ausgabenklasse im Innenring", () => {
    const result = buildSpendingSunburst(
      [
        tx({ amount: -700, category_id: "miete" }),
        tx({ amount: -60, category_id: "kraftstoff" }),
        tx({ amount: -40, category_id: "parken" }),
        tx({ amount: -200, category_id: "sparen" }),
      ],
      klassCats
    );
    expect(result.total).toBe(1000);
    const inner = Object.fromEntries(result.inner.map((i) => [i.id, i.value]));
    expect(inner.essenziell).toBe(760); // Miete 700 + Kraftstoff 60
    expect(inner.diskretionaer).toBe(40); // Parken
    expect(inner.sparen).toBe(200);
  });

  it("spaltet eine Hauptkategorie über Klassen im Außenring auf", () => {
    const result = buildSpendingSunburst(
      [
        tx({ amount: -60, category_id: "kraftstoff" }),
        tx({ amount: -40, category_id: "parken" }),
      ],
      klassCats
    );
    // Mobilität erscheint sowohl unter essenziell als auch unter diskretionaer
    const mobilOuter = result.outer.filter((o) => o.name === "Mobilität");
    expect(mobilOuter).toHaveLength(2);
    expect(mobilOuter.find((o) => o.parentId === "essenziell")?.value).toBe(60);
    expect(mobilOuter.find((o) => o.parentId === "diskretionaer")?.value).toBe(40);
  });

  it("legt unkategorisierte Ausgaben in einen eigenen Innenring-Slice ohne Außenring", () => {
    const result = buildSpendingSunburst([tx({ amount: -25 })], klassCats);
    expect(result.inner).toEqual([{ id: "unkategorisiert", name: "Unkategorisiert", value: 25 }]);
    expect(result.outer).toEqual([]);
  });

  it("ignoriert Einnahmen und Nullbeträge", () => {
    const result = buildSpendingSunburst(
      [tx({ amount: 2000 }), tx({ amount: 0, category_id: "miete" })],
      klassCats
    );
    expect(result.total).toBe(0);
    expect(result.inner).toEqual([]);
  });

  it("resolveAusgabenklasse erbt die Klasse vom Parent, wenn die Unterkategorie keine hat", () => {
    const cats: Category[] = [
      { id: "p", name: "P", filters: [], attributes: { ausgabenklasse: "sparen" } },
      { id: "c", name: "C", filters: [], parent_id: "p" },
    ];
    const byId = new Map(cats.map((c) => [c.id, c]));
    expect(resolveAusgabenklasse(byId, "c")).toBe("sparen");
    expect(resolveAusgabenklasse(byId, null)).toBeNull();
  });
});
