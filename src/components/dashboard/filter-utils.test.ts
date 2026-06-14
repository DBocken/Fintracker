import { describe, it, expect } from "vitest";
import { filterTransactions, getDashboardDateRange, type DashboardFilterState } from "./filter-utils";
import { DEFAULT_DASHBOARD_FILTERS } from "./filter-constants";
import type { Account, Category, Transaction } from "@/types";

const NOW = new Date("2024-06-15T12:00:00Z");

function tx(partial: Partial<Transaction> & { id: string; date: string }): Transaction {
  return {
    payee: "",
    description: "",
    original_text: "",
    amount: 0,
    currency: "EUR",
    category_id: null,
    subcategory_id: null,
    auto_mapped: false,
    confirmed: false,
    ...partial,
  } as Transaction;
}

const baseFilters: DashboardFilterState = {
  category: DEFAULT_DASHBOARD_FILTERS.category,
  account: DEFAULT_DASHBOARD_FILTERS.account,
  contract: DEFAULT_DASHBOARD_FILTERS.contract,
  essential: DEFAULT_DASHBOARD_FILTERS.essential,
  ausgabenklasse: DEFAULT_DASHBOARD_FILTERS.ausgabenklasse,
  search: DEFAULT_DASHBOARD_FILTERS.search,
  range: DEFAULT_DASHBOARD_FILTERS.range,
  customDays: DEFAULT_DASHBOARD_FILTERS.customDays,
};

const categories: Category[] = [];
const accounts: Account[] = [];

describe("getDashboardDateRange", () => {
  it("liefert für '30 Tage' ein 30-Tage-Fenster", () => {
    const { start, end } = getDashboardDateRange("30 Tage", 30, NOW);
    const diffDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    expect(diffDays).toBe(30);
  });
});

describe("filterTransactions", () => {
  const txs = [
    tx({ id: "1", date: "2024-06-10", payee: "REWE", description: "Wocheneinkauf" }),
    tx({ id: "2", date: "2024-01-01", payee: "Netflix", description: "Abo" }),
    tx({ id: "3", date: "2024-06-14", payee: "Bäckerei Müller", description: "Brötchen" }),
  ];

  it("findet per Suchtext über Payee und Beschreibung (case-insensitive)", () => {
    const result = filterTransactions(txs, categories, accounts, { ...baseFilters, search: "rewe" }, NOW);
    expect(result.map((t) => t.id)).toEqual(["1"]);
  });

  it("schränkt auf das Datumsfenster der Range ein", () => {
    const result = filterTransactions(txs, categories, accounts, { ...baseFilters, range: "30 Tage" }, NOW);
    expect(result.map((t) => t.id).sort()).toEqual(["1", "3"]);
  });

  it("gibt bei 'Gesamt' und leerer Suche alle Transaktionen zurück", () => {
    const result = filterTransactions(txs, categories, accounts, baseFilters, NOW);
    expect(result).toHaveLength(3);
  });
});
