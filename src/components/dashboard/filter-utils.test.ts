import { describe, it, expect } from "vitest";
import {
  filterTransactions,
  getDashboardDateRange,
  encodeDashboardFilters,
  decodeDashboardFilters,
  buildTransactionsHref,
  type DashboardFilterState,
} from "./filter-utils";
import { DEFAULT_DASHBOARD_FILTERS } from "./filter-constants";
import { merchantFingerprint } from "@/lib/merchant-fingerprint";
import type { ContractDecision } from "@/services/contract-decision-service";
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

  it("Kategorie-Filter ist hierarchie-bewusst (Haupt erfasst Unterkategorien)", () => {
    const cats: Category[] = [
      { id: "main", name: "Wohnen", parent_id: null } as Category,
      { id: "sub", name: "Strom", parent_id: "main" } as Category,
    ];
    const list = [
      tx({ id: "a", date: "2024-06-10", category_id: "main" }),
      tx({ id: "b", date: "2024-06-10", category_id: "main", subcategory_id: "sub" }),
      tx({ id: "c", date: "2024-06-10", category_id: "other" }),
    ];
    const byMain = filterTransactions(list, cats, accounts, { ...baseFilters, category: "main" }, NOW);
    expect(byMain.map((t) => t.id).sort()).toEqual(["a", "b"]);

    const bySub = filterTransactions(list, cats, accounts, { ...baseFilters, category: "sub" }, NOW);
    expect(bySub.map((t) => t.id)).toEqual(["b"]);
  });

  it("[REGRESSION] Essential-/Klasse-Filter nutzen die Unterkategorie (Sub-Override, F-UX-5)", () => {
    // Diskretionäre Hauptkategorie mit einer essenziellen Unterkategorie.
    const cats: Category[] = [
      { id: "main", name: "Sonstiges", parent_id: null, attributes: { ausgabenklasse: "diskretionaer", essenziell: false } } as Category,
      { id: "sub", name: "Medikamente", parent_id: "main", attributes: { ausgabenklasse: "essenziell", essenziell: true } } as Category,
    ];
    const list = [
      tx({ id: "sub-ess", date: "2024-06-10", amount: -20, category_id: "main", subcategory_id: "sub" }),
      tx({ id: "main-only", date: "2024-06-10", amount: -15, category_id: "main" }),
    ];

    // Essenziell-Filter: nur die Buchung mit essenzieller Unterkategorie.
    const ess = filterTransactions(list, cats, accounts, { ...baseFilters, essential: "ess" }, NOW);
    expect(ess.map((t) => t.id)).toEqual(["sub-ess"]);

    // Ausgabenklasse-Filter „essenziell": ebenfalls über die Unterkategorie.
    const klasse = filterTransactions(list, cats, accounts, { ...baseFilters, ausgabenklasse: "essenziell" }, NOW);
    expect(klasse.map((t) => t.id)).toEqual(["sub-ess"]);
  });
});

describe("buildTransactionsHref", () => {
  it("baut Deep-Link mit Kategorie", () => {
    expect(buildTransactionsHref({ category: "cat-9" })).toBe("/transactions?cat=cat-9");
  });
  it("baut Deep-Link mit Ausgabenklasse", () => {
    expect(buildTransactionsHref({ ausgabenklasse: "essenziell" })).toBe("/transactions?klasse=essenziell");
  });
  it("liefert nackten Pfad ohne Filter", () => {
    expect(buildTransactionsHref({})).toBe("/transactions");
  });
});

describe("Vertragsfilter über zentrale Vertragsauflösung", () => {
  function decisionMap(...entries: Array<[Transaction, ContractDecision["status"]]>): Map<string, ContractDecision> {
    const map = new Map<string, ContractDecision>();
    entries.forEach(([t, status]) => {
      map.set(merchantFingerprint(t), {
        id: crypto.randomUUID(),
        user_id: "local",
        fingerprint: merchantFingerprint(t),
        status,
      });
    });
    return map;
  }

  const contractCat: Category = { id: "c-abo", name: "Abos", attributes: { ist_vertrag: true } } as Category;
  const cats = [contractCat];

  const netflix = tx({ id: "n1", date: "2024-06-10", payee: "Netflix", amount: -12.99, category_id: "c-abo" });
  const rewe = tx({ id: "r1", date: "2024-06-10", payee: "REWE", amount: -40, category_id: null });

  it("zeigt Buchung mit Kategorie ist_vertrag als Vertrag (Legacy ohne Entscheidung)", () => {
    const result = filterTransactions([netflix, rewe], cats, accounts, { ...baseFilters, contract: "vertrag" }, NOW);
    expect(result.map((t) => t.id)).toEqual(["n1"]);
  });

  it("blendet einen ausdrücklich beendeten Vertrag aus dem Vertragsfilter aus", () => {
    const decisions = decisionMap([netflix, "ended"]);
    const result = filterTransactions([netflix, rewe], cats, accounts, { ...baseFilters, contract: "vertrag" }, NOW, decisions);
    expect(result.map((t) => t.id)).toEqual([]);
  });

  it("ein beendeter Vertrag erscheint im 'kein Vertrag'-Filter", () => {
    const decisions = decisionMap([netflix, "ended"]);
    const result = filterTransactions([netflix, rewe], cats, accounts, { ...baseFilters, contract: "kein_vertrag" }, NOW, decisions);
    expect(result.map((t) => t.id).sort()).toEqual(["n1", "r1"]);
  });

  it("erkennt is_contract auch ohne Kategorie-Attribut als Vertrag", () => {
    const flagged = tx({ id: "f1", date: "2024-06-10", payee: "Fitness", amount: -29.9, is_contract: true });
    const result = filterTransactions([flagged, rewe], cats, accounts, { ...baseFilters, contract: "vertrag" }, NOW);
    expect(result.map((t) => t.id)).toEqual(["f1"]);
  });

  it("eine aktive Entscheidung überstimmt fehlendes Kategorie-Attribut", () => {
    const decisions = decisionMap([rewe, "active"]);
    const result = filterTransactions([netflix, rewe], cats, accounts, { ...baseFilters, contract: "vertrag" }, NOW, decisions);
    expect(result.map((t) => t.id).sort()).toEqual(["n1", "r1"]);
  });
});

describe("Filter-URL Encode/Decode (Audit P1.3)", () => {
  const base: DashboardFilterState = {
    category: "all",
    account: "all",
    contract: "all",
    essential: "all",
    ausgabenklasse: "all",
    search: "",
    range: "Gesamt",
    customDays: 30,
  };

  it("kodiert nur abweichende Werte (Defaults bleiben leer)", () => {
    expect(encodeDashboardFilters(base).toString()).toBe("");
  });

  it("Round-Trip erhält gesetzte Filter", () => {
    const filters: DashboardFilterState = {
      ...base,
      category: "cat-1",
      account: "acc-1",
      contract: "vertrag",
      ausgabenklasse: "essenziell",
      search: "Aldi",
      range: "30 Tage",
    };
    const decoded = decodeDashboardFilters(encodeDashboardFilters(filters));
    expect(decoded).toMatchObject({
      category: "cat-1",
      account: "acc-1",
      contract: "vertrag",
      ausgabenklasse: "essenziell",
      search: "Aldi",
      range: "30 Tage",
    });
  });

  it("kodiert customDays nur bei benutzerdefiniertem Zeitraum", () => {
    const custom = encodeDashboardFilters({ ...base, range: "Benutzerdefiniert", customDays: 45 });
    expect(custom.get("range")).toBe("custom");
    expect(custom.get("days")).toBe("45");
    const decoded = decodeDashboardFilters(custom);
    expect(decoded.range).toBe("Benutzerdefiniert");
    expect(decoded.customDays).toBe(45);
  });

  it("fällt bei unbekanntem Range-Token auf Gesamt zurück", () => {
    const decoded = decodeDashboardFilters(new URLSearchParams("range=xyz"));
    expect(decoded.range).toBe("Gesamt");
  });
});
