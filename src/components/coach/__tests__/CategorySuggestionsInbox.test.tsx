import { screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderWithI18n } from "@/test-utils/render";
import CategorySuggestionsInbox from "../CategorySuggestionsInbox";
import type { AutomationSuggestion } from "@/lib/automation-suggestion-model";

const accept = vi.fn();
const reject = vi.fn();
let mockState: {
  suggestions: AutomationSuggestion[];
  categoryNameById: Map<string, string>;
};

vi.mock("@/hooks/useAutomationSuggestions", () => ({
  useAutomationSuggestions: () => ({
    suggestions: mockState.suggestions,
    categoryNameById: mockState.categoryNameById,
    accept,
    reject,
    isBusy: false,
    isLoading: false,
  }),
}));

function suggestion(partial: Partial<AutomationSuggestion> = {}): AutomationSuggestion {
  return {
    id: "category:t1",
    kind: "category",
    entityType: "transaction",
    entityId: "t1",
    title: "Kategorie-Vorschlag für REWE Markt",
    description: "Beschreibung enthält Filter rewe",
    confidence: 0.85,
    reasons: ["Beschreibung enthält Filter rewe"],
    proposedChange: { category_id: "c-food" },
    status: "pending",
    created_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("CategorySuggestionsInbox", () => {
  beforeEach(() => {
    accept.mockClear();
    reject.mockClear();
    mockState = { suggestions: [], categoryNameById: new Map([["c-food", "Lebensmittel"]]) };
  });

  it("sollte nichts rendern, wenn keine Vorschlaege offen sind", () => {
    const { container } = renderWithI18n(<CategorySuggestionsInbox />, 'de');
    expect(container).toBeEmptyDOMElement();
  });

  describe("German locale", () => {
    it("sollte Vorschlag mit Kategorie, Sicherheitsstufe und Grund anzeigen", () => {
      mockState.suggestions = [suggestion()];
      renderWithI18n(<CategorySuggestionsInbox />, 'de');

      expect(screen.getByText("Kategorie-Vorschlag für REWE Markt")).toBeInTheDocument();
      expect(screen.getByText("Lebensmittel")).toBeInTheDocument();
      expect(screen.getByText(/hoch.*Sicherheit/)).toBeInTheDocument();
      expect(screen.getByText("Beschreibung enthält Filter rewe")).toBeInTheDocument();
    });

    it("sollte beim Uebernehmen accept mit dem Vorschlag aufrufen", () => {
      const s = suggestion();
      mockState.suggestions = [s];
      renderWithI18n(<CategorySuggestionsInbox />, 'de');
      fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));
      expect(accept).toHaveBeenCalledWith(s);
    });

    it("sollte beim Ablehnen reject mit dem Vorschlag aufrufen", () => {
      const s = suggestion();
      mockState.suggestions = [s];
      renderWithI18n(<CategorySuggestionsInbox />, 'de');
      fireEvent.click(screen.getByRole("button", { name: /Vorschlag ablehnen/ }));
      expect(reject).toHaveBeenCalledWith(s);
    });
  });

  describe("English locale", () => {
    it("should show suggestion with category, confidence level and reason", () => {
      mockState.suggestions = [suggestion()];
      mockState.categoryNameById = new Map([["c-food", "Groceries"]]);
      renderWithI18n(<CategorySuggestionsInbox />, 'en');

      expect(screen.getByText("Kategorie-Vorschlag für REWE Markt")).toBeInTheDocument();
      expect(screen.getByText("Groceries")).toBeInTheDocument();
      expect(screen.getByText(/hoch.*confidence/)).toBeInTheDocument();
      expect(screen.getByText("Beschreibung enthält Filter rewe")).toBeInTheDocument();
    });

    it("should call accept with suggestion on accept", () => {
      const s = suggestion();
      mockState.suggestions = [s];
      renderWithI18n(<CategorySuggestionsInbox />, 'en');
      fireEvent.click(screen.getByRole("button", { name: "Accept" }));
      expect(accept).toHaveBeenCalledWith(s);
    });

    it("should call reject with suggestion on reject", () => {
      const s = suggestion();
      mockState.suggestions = [s];
      renderWithI18n(<CategorySuggestionsInbox />, 'en');
      fireEvent.click(screen.getByRole("button", { name: /Reject suggestion/ }));
      expect(reject).toHaveBeenCalledWith(s);
    });
  });
});
