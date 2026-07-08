import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import type { Category, Transaction } from "@/types";
import { I18nProvider } from "@/i18n/I18nProvider";

vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: [] }) }));
vi.mock("@/components/categories/CategoryTwoStepSelect", () => ({
  CategoryTwoStepSelect: () => <div data-testid="cat-select" />,
}));
vi.mock("@/components/FeatureGate", () => ({
  FeatureGate: ({ fallback }: { fallback?: React.ReactNode }) => <>{fallback ?? null}</>,
}));
vi.mock("@/services/transaction-service", () => ({
  explainCategorization: () => ({ categoryId: null, confidence: 0, reasons: [] }),
}));
vi.mock("@/services/audit-log-service", () => ({ safeAudit: vi.fn(), redactForAudit: (x: unknown) => x }));
vi.mock("@/services/merchant-rules-service", () => ({ getMerchantRules: vi.fn(), upsertMerchantRule: vi.fn() }));

import { TransactionDetailsPanel } from "./TransactionDetailsPanel";

const CATS: Category[] = [{ id: "food", name: "Lebensmittel", parent_id: null } as Category];
const TX: Transaction = {
  id: "t1",
  date: "2026-07-02",
  amount: -117.6,
  payee: "Santander",
  description: "Rate Möbelkredit",
  original_text: "",
  category_id: "food",
  auto_mapped: false,
  confirmed: true,
};

function renderPanel(layout: "stacked" | "split") {
  return render(
    <I18nProvider initialLocale="de">
      <MemoryRouter>
        <TransactionDetailsPanel
          transaction={TX}
          categories={CATS}
          accounts={[]}
          allTransactions={[TX]}
          onSave={vi.fn()}
          onClose={vi.fn()}
          layout={layout}
        />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("TransactionDetailsPanel – Split-Layout (horizontal, 2 Spalten)", () => {
  it("[REGRESSION] sollte im Split-Layout zwei ausbalancierte Spalten (Masonry) anlegen", () => {
    const { container } = renderPanel("split");
    // Abschnitte fließen in zwei Spalten und füllen den Platz beidseitig.
    expect(container.querySelector(".md\\:columns-2")).toBeTruthy();
    // Beide Bereiche sind vorhanden.
    expect(screen.getByText("Datum")).toBeTruthy();
    expect(screen.getByText("Kategorisierung")).toBeTruthy();
  });

  it("sollte im Stacked-Layout kein Mehrspalten-Layout verwenden", () => {
    const { container } = renderPanel("stacked");
    expect(container.querySelector(".md\\:columns-2")).toBeNull();
    expect(screen.getByText("Kategorisierung")).toBeTruthy();
  });

  it("sollte englische Texte korrekt rendern", () => {
    render(
      <I18nProvider initialLocale="en">
        <MemoryRouter>
          <TransactionDetailsPanel
            transaction={TX}
            categories={CATS}
            accounts={[]}
            allTransactions={[TX]}
            onSave={vi.fn()}
            onClose={vi.fn()}
            layout="split"
          />
        </MemoryRouter>
      </I18nProvider>,
    );
    // Überprüfe dass englische Translations geladen sind
    expect(screen.getByText("Categorization")).toBeTruthy();
    expect(screen.getByText("Internal Transfer")).toBeTruthy();
  });
});
