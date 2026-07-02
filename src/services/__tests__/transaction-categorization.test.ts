import { describe, expect, it } from "vitest";
import { categorizeTransaction } from "../transaction-service";
import type { Category, Transaction } from "../../types";

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    date: "2024-01-15",
    amount: -10,
    payee: "",
    description: "",
    original_text: "",
    auto_mapped: false,
    confirmed: false,
    ...overrides,
  };
}

function category(overrides: Partial<Category>): Category {
  return {
    id: overrides.id || crypto.randomUUID(),
    name: "Kategorie",
    filters: [],
    ...overrides,
  };
}

describe("categorizeTransaction", () => {
  it("returns null when no category matches", () => {
    const transaction = tx({ payee: "Unbekannt", description: "Sonstiges" });
    const categories = [category({ id: "food", filters: ["rewe", "aldi"] })];

    expect(categorizeTransaction(transaction, categories)).toBeNull();
  });

  it("matches based on the payee field", () => {
    const transaction = tx({ payee: "REWE Markt GmbH" });
    const categories = [category({ id: "food", filters: ["rewe"] })];

    expect(categorizeTransaction(transaction, categories)).toBe("food");
  });

  it("matches based on the description field", () => {
    const transaction = tx({ payee: "Unbekannt", description: "Wocheneinkauf bei Aldi" });
    const categories = [category({ id: "food", filters: ["aldi"] })];

    expect(categorizeTransaction(transaction, categories)).toBe("food");
  });

  it("matches based on original_text when payee/description don't match", () => {
    const transaction = tx({ payee: "X", description: "Y", original_text: "ZAHLUNG LUFTHANSA FLUG" });
    const categories = [category({ id: "travel", filters: ["lufthansa"] })];

    expect(categorizeTransaction(transaction, categories)).toBe("travel");
  });

  it("is case-insensitive", () => {
    const transaction = tx({ payee: "rewe markt" });
    const categories = [category({ id: "food", filters: ["REWE"] })];

    expect(categorizeTransaction(transaction, categories)).toBe("food");
  });

  it("picks the category with the most matching filters (specificity)", () => {
    const transaction = tx({ payee: "Rewe Markt", description: "Milch und Joghurt" });
    const categories = [
      category({ id: "food-general", filters: ["rewe"] }),
      category({ id: "food-dairy", filters: ["rewe", "milch", "joghurt"] }),
    ];

    expect(categorizeTransaction(transaction, categories)).toBe("food-dairy");
  });

  it("keeps the first category when specificity is tied", () => {
    const transaction = tx({ payee: "Rewe Markt" });
    const categories = [
      category({ id: "first", filters: ["rewe"] }),
      category({ id: "second", filters: ["markt"] }),
    ];

    // Both match exactly one filter; the first category encountered wins
    // because the loop only replaces bestMatch on a strictly greater count.
    expect(categorizeTransaction(transaction, categories)).toBe("first");
  });

  it("requires a strictly greater match count to override the current best match", () => {
    const transaction = tx({ payee: "Aldi Lidl Rewe" });
    const categories = [
      category({ id: "two-matches", filters: ["aldi", "lidl"] }),
      category({ id: "one-match", filters: ["rewe"] }),
      category({ id: "also-two", filters: ["aldi", "rewe"] }),
    ];

    expect(categorizeTransaction(transaction, categories)).toBe("two-matches");
  });

  it("treats an empty categories list as no match", () => {
    expect(categorizeTransaction(tx({ payee: "Rewe" }), [])).toBeNull();
  });

  it("treats categories without filters as never matching", () => {
    const transaction = tx({ payee: "Rewe Markt" });
    const categories = [category({ id: "no-filters", filters: [] })];

    expect(categorizeTransaction(transaction, categories)).toBeNull();
  });

  it("matches via normalized payee when raw payee contains noise", () => {
    const transaction = tx({ payee: "PAYMENT 847261 REWE SAGT DANKE 3847 DE//MUENCHEN/2024-01-05" });
    const categories = [category({ id: "food", filters: ["rewe sagt danke"] })];

    expect(categorizeTransaction(transaction, categories)).toBe("food");
  });

  it("prefers a learned merchant rule over filter matching", () => {
    const transaction = tx({ payee: "REWE Markt GmbH" });
    const categories = [category({ id: "food", filters: ["rewe"] })];
    const learnedRules = [
      { id: "1", user_id: "local", merchant_pattern: "rewe markt", category_id: "personal-groceries" },
    ];

    expect(categorizeTransaction(transaction, categories, learnedRules)).toBe("personal-groceries");
  });

  it("falls back to a learned rule when no filter matches", () => {
    const transaction = tx({ payee: "Hundeschule Müller" });
    const categories = [category({ id: "food", filters: ["rewe"] })];
    const learnedRules = [
      { id: "1", user_id: "local", merchant_pattern: "hundeschule müller", category_id: "pets" },
    ];

    expect(categorizeTransaction(transaction, categories, learnedRules)).toBe("pets");
  });

  it("[REGRESSION] wählt die spezifischste (längste) passende Regel, nicht die zuerst gespeicherte", () => {
    const transaction = tx({ payee: "ALDI SÜD TANKSTELLE" });
    const categories: ReturnType<typeof category>[] = [];
    // Die generische Regel „aldi" ist ZUERST gespeichert; die genauere Regel
    // „aldi süd tankstelle" muss trotzdem gewinnen.
    const learnedRules = [
      { id: "1", user_id: "local", merchant_pattern: "aldi", category_id: "groceries" },
      { id: "2", user_id: "local", merchant_pattern: "aldi süd tankstelle", category_id: "fuel" },
    ];

    expect(categorizeTransaction(transaction, categories, learnedRules)).toBe("fuel");
  });

  it("falls back to a regex rule when no category filter matches", () => {
    const transaction = tx({ payee: "Aral Tankstelle Berlin", description: "Tanken" });
    const categories = [category({ id: "mobility", name: "Mobilität", filters: [] })];

    expect(categorizeTransaction(transaction, categories)).toBe("mobility");
  });

  it("does not apply a regex fallback if the matching category does not exist", () => {
    const transaction = tx({ payee: "Aral Tankstelle Berlin", description: "Tanken" });
    const categories = [category({ id: "other", name: "Sonstiges", filters: [] })];

    expect(categorizeTransaction(transaction, categories)).toBeNull();
  });
});
