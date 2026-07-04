import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
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
    description: "Beschreibung enthält Filter rewe",
    confidence: 0.85,
    reasons: ["Beschreibung enthält Filter rewe"],
    proposedChange: { category_id: "c-food" },
    status: "pending",
    created_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function renderWithI18n(component: React.ReactElement) {
  return render(
    <I18nProvider>
      {component}
    </I18nProvider>,
  );
}

describe("CategorySuggestionsInbox", () => {
  beforeEach(() => {
    accept.mockClear();
    reject.mockClear();
    mockState = { suggestions: [], categoryNameById: new Map([["c-food", "Lebensmittel"]]) };
  });

  it("sollte nichts rendern, wenn keine Vorschlaege offen sind", () => {
    const { container } = renderWithI18n(<CategorySuggestionsInbox />);
    expect(container).toBeEmptyDOMElement();
  });

  it("sollte Vorschlag mit Kategorie, Sicherheitsstufe und Grund anzeigen", () => {
    mockState.suggestions = [suggestion()];
    renderWithI18n(<CategorySuggestionsInbox />);

    expect(screen.getByText("Kategorie-Vorschlag für REWE Markt")).toBeInTheDocument();
    expect(screen.getByText("Lebensmittel")).toBeInTheDocument();
    expect(screen.getByText(/hoch.*confidence|hoch.*Sicherheit/)).toBeInTheDocument();
    expect(screen.getByText("Beschreibung enthält Filter rewe")).toBeInTheDocument();
  });

  it("sollte beim Uebernehmen accept mit dem Vorschlag aufrufen", () => {
    const s = suggestion();
    mockState.suggestions = [s];
    renderWithI18n(<CategorySuggestionsInbox />);
    fireEvent.click(screen.getByRole("button", { name: /Accept|Uebernehmen/ }));
    expect(accept).toHaveBeenCalledWith(s);
  });

  it("sollte beim Ablehnen reject mit dem Vorschlag aufrufen", () => {
    const s = suggestion();
    mockState.suggestions = [s];
    renderWithI18n(<CategorySuggestionsInbox />);
    fireEvent.click(screen.getByRole("button", { name: /Vorschlag ablehnen|Reject suggestion/ }));
    expect(reject).toHaveBeenCalledWith(s);
  });
});
