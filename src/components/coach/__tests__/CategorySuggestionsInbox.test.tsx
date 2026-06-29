import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import CategorySuggestionsInbox from "../CategorySuggestionsInbox";
import type { AutomationSuggestion } from "@/services/automation-suggestion-service";

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
    description: "Beschreibung enthält Filter „rewe“",
    confidence: 0.85,
    reasons: ["Beschreibung enthält Filter „rewe“"],
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

  it("sollte nichts rendern, wenn keine Vorschläge offen sind", () => {
    const { container } = render(<CategorySuggestionsInbox />);
    expect(container).toBeEmptyDOMElement();
  });

  it("sollte Vorschlag mit Kategorie, Sicherheitsstufe und Grund anzeigen", () => {
    mockState.suggestions = [suggestion()];
    render(<CategorySuggestionsInbox />);

    expect(screen.getByText("Kategorie-Vorschlag für REWE Markt")).toBeInTheDocument();
    expect(screen.getByText("Lebensmittel")).toBeInTheDocument();
    expect(screen.getByText("hoch Sicherheit")).toBeInTheDocument();
    expect(screen.getByText("Beschreibung enthält Filter „rewe“")).toBeInTheDocument();
  });

  it("sollte beim Übernehmen accept mit dem Vorschlag aufrufen", () => {
    const s = suggestion();
    mockState.suggestions = [s];
    render(<CategorySuggestionsInbox />);
    fireEvent.click(screen.getByRole("button", { name: /Übernehmen/ }));
    expect(accept).toHaveBeenCalledWith(s);
  });

  it("sollte beim Ablehnen reject mit dem Vorschlag aufrufen", () => {
    const s = suggestion();
    mockState.suggestions = [s];
    render(<CategorySuggestionsInbox />);
    fireEvent.click(screen.getByRole("button", { name: /Vorschlag ablehnen/ }));
    expect(reject).toHaveBeenCalledWith(s);
  });
});
