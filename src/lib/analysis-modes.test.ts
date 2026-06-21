import { describe, it, expect } from "vitest";
import { computeTypicalMonth, computeTrend, listMonths, computeMonthComparison } from "./analysis-modes";
import type { Transaction } from "@/types";

function tx(date: string, amount: number, extra: Partial<Transaction> = {}): Transaction {
  return {
    date,
    amount,
    payee: "",
    description: "",
    original_text: "",
    auto_mapped: false,
    confirmed: true,
    ...extra,
  };
}

const NOW = new Date("2026-03-15T12:00:00Z");

describe("listMonths", () => {
  it("liefert sortierte, eindeutige Monate ohne Transfers", () => {
    const txs = [tx("2026-01-10", -10), tx("2026-01-20", -5), tx("2026-02-01", 100), tx("2026-02-02", -1, { is_transfer: true })];
    expect(listMonths(txs)).toEqual(["2026-01", "2026-02"]);
  });
});

describe("computeTypicalMonth", () => {
  it("mittelt über abgeschlossene Monate und schließt den laufenden Monat aus", () => {
    const txs = [
      tx("2026-01-01", 1000),
      tx("2026-01-15", -400),
      tx("2026-02-01", 1000),
      tx("2026-02-15", -600),
      // Laufender Monat (März) – unvollständig, ausgeschlossen:
      tx("2026-03-01", 1000),
      tx("2026-03-10", -50),
    ];
    const r = computeTypicalMonth(txs, NOW);
    expect(r.monthsCounted).toBe(2);
    expect(r.partial).toBe(false);
    expect(r.income).toBeCloseTo(1000, 2);
    expect(r.expenses).toBeCloseTo(500, 2); // (400 + 600) / 2
    expect(r.net).toBeCloseTo(500, 2);
  });

  it("Lückenmonate ohne Daten deflationieren den Durchschnitt nicht", () => {
    const txs = [tx("2026-01-10", -300), tx("2026-02-10", -300)];
    // Februar ist der letzte abgeschlossene Monat; beide zählen → 300, nicht 200.
    const r = computeTypicalMonth(txs, new Date("2026-03-01T00:00:00Z"));
    expect(r.monthsCounted).toBe(2);
    expect(r.expenses).toBeCloseTo(300, 2);
  });

  it("behandelt Jahreswechsel korrekt", () => {
    const txs = [tx("2025-12-10", -200), tx("2026-01-10", -400)];
    const r = computeTypicalMonth(txs, new Date("2026-02-01T00:00:00Z"));
    expect(r.monthsCounted).toBe(2);
    expect(r.expenses).toBeCloseTo(300, 2);
  });

  it("bezieht bei nur laufendem Monat diesen ein und markiert partial", () => {
    const txs = [tx("2026-03-05", -100), tx("2026-03-12", 500)];
    const r = computeTypicalMonth(txs, NOW);
    expect(r.partial).toBe(true);
    expect(r.monthsCounted).toBe(1);
    expect(r.expenses).toBeCloseTo(100, 2);
  });

  it("liefert Nullwerte ohne Daten", () => {
    const r = computeTypicalMonth([], NOW);
    expect(r).toMatchObject({ income: 0, expenses: 0, net: 0, monthsCounted: 0, partial: false });
  });

  it("berücksichtigt den 29. Februar im Schaltjahr", () => {
    const txs = [tx("2024-02-29", -100), tx("2024-02-15", -100)];
    const r = computeTypicalMonth(txs, new Date("2024-03-10T00:00:00Z"));
    expect(r.monthsCounted).toBe(1);
    expect(r.expenses).toBeCloseTo(200, 2);
  });
});

describe("computeTrend", () => {
  it("vergleicht aktuellen mit gleich langem Vorzeitraum", () => {
    const txs = [
      // Vorperiode 01.–31.01
      tx("2026-01-10", -100, { category_id: "essen" }),
      tx("2026-01-20", 500),
      // Aktuelle Periode 01.–31.02 (gleich lang über Tagesdifferenz)
      tx("2026-02-10", -300, { category_id: "essen" }),
      tx("2026-02-20", 500),
    ];
    const current = { start: new Date("2026-02-01T00:00:00Z"), end: new Date("2026-03-01T00:00:00Z") };
    const r = computeTrend(txs, current);
    expect(r.current.expenses).toBeCloseTo(300, 2);
    expect(r.previous.expenses).toBeCloseTo(100, 2);
    expect(r.expensesChangePct).toBeCloseTo(200, 2); // von 100 auf 300 = +200%
    expect(r.topCauses[0]).toMatchObject({ categoryId: "essen", delta: 200 });
  });

  it("liefert null-Prozent wenn die Vorperiode keine Ausgaben hatte", () => {
    const txs = [tx("2026-02-10", -300)];
    const current = { start: new Date("2026-02-01T00:00:00Z"), end: new Date("2026-03-01T00:00:00Z") };
    const r = computeTrend(txs, current);
    expect(r.previous.expenses).toBe(0);
    expect(r.expensesChangePct).toBeNull();
  });

  it("ignoriert teilweise importierte/leere Vorperioden ohne Fehler", () => {
    const txs = [tx("2026-02-15", -50)];
    const current = { start: new Date("2026-02-01T00:00:00Z"), end: new Date("2026-03-01T00:00:00Z") };
    const r = computeTrend(txs, current);
    expect(r.current.expenses).toBeCloseTo(50, 2);
    expect(r.previous).toMatchObject({ income: 0, expenses: 0, net: 0 });
    expect(r.topCauses).toHaveLength(1);
  });
});

describe("computeMonthComparison", () => {
  it("vergleicht zwei Kalendermonate direkt", () => {
    const txs = [
      tx("2026-01-10", 2000),
      tx("2026-01-20", -800),
      tx("2026-02-10", 2000),
      tx("2026-02-20", -1000),
      tx("2026-02-25", -200),
    ];
    const r = computeMonthComparison(txs, "2026-01", "2026-02");
    expect(r.a.expenses).toBeCloseTo(800, 2);
    expect(r.b.expenses).toBeCloseTo(1200, 2);
    expect(r.delta.expenses).toBeCloseTo(400, 2);
    expect(r.delta.net).toBeCloseTo(-400, 2);
    expect(r.expensesChangePct).toBeCloseTo(50, 2);
  });

  it("ignoriert Transfers", () => {
    const txs = [tx("2026-01-10", -100), tx("2026-01-11", -50, { is_transfer: true })];
    const r = computeMonthComparison(txs, "2026-01", "2026-02");
    expect(r.a.expenses).toBeCloseTo(100, 2);
    expect(r.b.expenses).toBe(0);
  });

  it("liefert null-Prozent wenn Monat A keine Ausgaben hatte", () => {
    const txs = [tx("2026-02-10", -300)];
    const r = computeMonthComparison(txs, "2026-01", "2026-02");
    expect(r.a.expenses).toBe(0);
    expect(r.expensesChangePct).toBeNull();
  });

  it("identische Monate ergeben keine Differenz", () => {
    const txs = [tx("2026-01-10", -300), tx("2026-01-15", 1000)];
    const r = computeMonthComparison(txs, "2026-01", "2026-01");
    expect(r.delta).toMatchObject({ income: 0, expenses: 0, net: 0 });
    expect(r.expensesChangePct).toBeCloseTo(0, 2);
  });
});
