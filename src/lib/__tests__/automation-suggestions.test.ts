import { describe, expect, it } from "vitest";
import {
  buildPendingCategorySuggestions,
  suggestionConfidenceLevel,
  MIN_SUGGEST_CONFIDENCE,
} from "@/lib/automation-suggestions";
import type { AutomationSuggestion } from "@/services/automation-suggestion-service";
import type { Category, Transaction } from "@/types";

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: "t1",
    payee: "",
    description: "",
    original_text: "",
    amount: -10,
    date: "2026-01-01",
    is_transfer: false,
    category_id: null,
    ...partial,
  } as Transaction;
}

function cat(id: string, name: string, filters: string[]): Category {
  return { id, name, filters } as Category;
}

const CATEGORIES: Category[] = [
  cat("c-food", "Lebensmittel", ["rewe", "edeka"]),
  cat("c-mobility", "Mobilität", ["db bahn"]),
];

describe("automation-suggestions Produzent", () => {
  describe("suggestionConfidenceLevel", () => {
    it("sollte Confidence in Stufen übersetzen", () => {
      expect(suggestionConfidenceLevel(0.95)).toBe("hoch");
      expect(suggestionConfidenceLevel(0.85)).toBe("hoch");
      expect(suggestionConfidenceLevel(0.7)).toBe("mittel");
      expect(suggestionConfidenceLevel(0.55)).toBe("niedrig");
    });
  });

  describe("buildPendingCategorySuggestions — Normal Behavior", () => {
    it("sollte für eine nicht zugeordnete, erkannte Buchung einen Vorschlag erzeugen", () => {
      const result = buildPendingCategorySuggestions(
        [tx({ id: "t1", payee: "REWE Markt GmbH" })],
        CATEGORIES,
        [],
        [],
      );
      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe("category");
      expect(result[0].entityId).toBe("t1");
      expect(result[0].proposedChange).toEqual({ category_id: "c-food" });
      expect(result[0].confidence).toBeGreaterThanOrEqual(MIN_SUGGEST_CONFIDENCE);
      expect(result[0].reasons.length).toBeGreaterThan(0);
    });
  });

  describe("buildPendingCategorySuggestions — Edge Cases", () => {
    it("sollte bereits zugeordnete Buchungen überspringen", () => {
      const result = buildPendingCategorySuggestions(
        [tx({ id: "t1", payee: "REWE Markt", category_id: "c-food" })],
        CATEGORIES,
        [],
        [],
      );
      expect(result).toHaveLength(0);
    });

    it("sollte Transfers überspringen", () => {
      const result = buildPendingCategorySuggestions(
        [tx({ id: "t1", payee: "REWE Markt", is_transfer: true })],
        CATEGORIES,
        [],
        [],
      );
      expect(result).toHaveLength(0);
    });

    it("sollte Buchungen ohne erkennbare Kategorie überspringen", () => {
      const result = buildPendingCategorySuggestions(
        [tx({ id: "t1", payee: "Qzx Nichtszuordenbar 7788" })],
        CATEGORIES,
        [],
        [],
      );
      expect(result).toHaveLength(0);
    });

    it("sollte Buchungen ohne id überspringen", () => {
      const result = buildPendingCategorySuggestions(
        [tx({ id: undefined, payee: "REWE Markt" })],
        CATEGORIES,
        [],
        [],
      );
      expect(result).toHaveLength(0);
    });
  });

  describe("buildPendingCategorySuggestions — Entscheidungen respektieren", () => {
    it("sollte bereits abgelehnte Vorschläge nicht erneut zeigen", () => {
      const decided: AutomationSuggestion[] = [
        { id: "category:t1", status: "rejected" } as AutomationSuggestion,
      ];
      const result = buildPendingCategorySuggestions(
        [tx({ id: "t1", payee: "REWE Markt" })],
        CATEGORIES,
        [],
        decided,
      );
      expect(result).toHaveLength(0);
    });

    it("sollte das Limit einhalten", () => {
      const txs = Array.from({ length: 5 }, (_, i) =>
        tx({ id: `t${i}`, payee: "EDEKA Center" }),
      );
      const result = buildPendingCategorySuggestions(txs, CATEGORIES, [], [], 3);
      expect(result).toHaveLength(3);
    });
  });
});
