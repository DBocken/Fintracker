import { describe, it, expect } from "vitest";
import { resolvePeriodRange, listAvailablePeriods } from "./period-utils";
import { getDashboardDateRange, encodeDashboardFilters, decodeDashboardFilters } from "./filter-utils";
import type { Transaction } from "@/types";

function tx(id: string, date: string): Transaction {
  return {
    id,
    date,
    payee: "",
    description: "",
    original_text: "",
    amount: -10,
    currency: "EUR",
    category_id: null,
    subcategory_id: null,
    auto_mapped: false,
    confirmed: false,
  } as Transaction;
}

describe("resolvePeriodRange", () => {
  it("resolves a year to Jan 1 – Dec 31", () => {
    const r = resolvePeriodRange("Jahr", "2026")!;
    expect(r.start.getFullYear()).toBe(2026);
    expect(r.start.getMonth()).toBe(0);
    expect(r.start.getDate()).toBe(1);
    expect(r.end.getMonth()).toBe(11);
    expect(r.end.getDate()).toBe(31);
  });

  it("resolves a quarter Q2 to Apr–Jun", () => {
    const r = resolvePeriodRange("Quartal", "2026-Q2")!;
    expect(r.start.getMonth()).toBe(3); // April
    expect(r.end.getMonth()).toBe(5); // June
  });

  it("resolves a month and handles leap February", () => {
    const r = resolvePeriodRange("Monat", "2024-02")!;
    expect(r.start.getMonth()).toBe(1);
    expect(r.end.getDate()).toBe(29); // 2024 is a leap year
  });

  it("returns null for malformed period", () => {
    expect(resolvePeriodRange("Jahr", "20xx")).toBeNull();
    expect(resolvePeriodRange("Quartal", "2026-Q5")).toBeNull();
    expect(resolvePeriodRange("Monat", "2026-13")).toBeNull();
    expect(resolvePeriodRange("Gesamt", "2026")).toBeNull();
  });
});

describe("getDashboardDateRange with periods", () => {
  it("uses resolved period when valid", () => {
    const r = getDashboardDateRange("Quartal", 30, new Date("2026-06-15"), "2026-Q1");
    expect(r.start.getMonth()).toBe(0); // Jan
    expect(r.end.getMonth()).toBe(2); // Mar
  });

  it("falls back to full history when period invalid/empty", () => {
    const now = new Date("2026-06-15");
    const r = getDashboardDateRange("Monat", 30, now, "");
    expect(r.start.getTime()).toBe(new Date(0).getTime());
    expect(r.end).toEqual(now);
  });
});

describe("listAvailablePeriods", () => {
  const txs = [tx("1", "2026-06-10"), tx("2", "2026-02-01"), tx("3", "2025-11-20")];

  it("lists distinct years, newest first", () => {
    const opts = listAvailablePeriods(txs, "Jahr");
    expect(opts.map((o) => o.value)).toEqual(["2026", "2025"]);
  });

  it("lists quarters newest first", () => {
    const opts = listAvailablePeriods(txs, "Quartal");
    expect(opts.map((o) => o.value)).toEqual(["2026-Q2", "2026-Q1", "2025-Q4"]);
  });

  it("lists months newest first", () => {
    const opts = listAvailablePeriods(txs, "Monat");
    expect(opts.map((o) => o.value)).toEqual(["2026-06", "2026-02", "2025-11"]);
  });
});

describe("encode/decode round-trip for periods", () => {
  it("encodes a period as range token and decodes back", () => {
    const params = encodeDashboardFilters({
      category: "all",
      account: "all",
      contract: "all",
      essential: "all",
      ausgabenklasse: "all",
      search: "",
      range: "Quartal",
      customDays: 30,
      customPeriod: "2026-Q2",
    });
    expect(params.get("range")).toBe("2026-Q2");

    const decoded = decodeDashboardFilters(params);
    expect(decoded.range).toBe("Quartal");
    expect(decoded.customPeriod).toBe("2026-Q2");
  });

  it("decodes legacy day tokens unchanged", () => {
    const decoded = decodeDashboardFilters(new URLSearchParams("range=30d"));
    expect(decoded.range).toBe("30 Tage");
    expect(decoded.customPeriod).toBe("");
  });
});
