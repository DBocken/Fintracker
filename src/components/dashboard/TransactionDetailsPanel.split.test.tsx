import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import type { Category, Transaction } from "@/types";

vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: [] }) }));
vi.mock("@/i18n/useI18n", () => ({ useI18n: () => ({ t: (_k: string, f?: string) => f ?? _k, locale: "de" }) }));
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
    </MemoryRouter>,
  );
}

describe("TransactionDetailsPanel – Split-Layout (horizontal 1/3 · 2/3)", () => {
  it("[REGRESSION] sollte im Split-Layout ein 3-Spalten-Raster (1/3 · 2/3) anlegen", () => {
    const { container } = renderPanel("split");
    // Stammdaten (links) und Bearbeitung (rechts) liegen im horizontalen Raster.
    expect(container.querySelector(".md\\:grid-cols-3")).toBeTruthy();
    expect(container.querySelector(".md\\:col-span-1")).toBeTruthy();
    expect(container.querySelector(".md\\:col-span-2")).toBeTruthy();
    // Beide Bereiche sind vorhanden.
    expect(screen.getByText("Datum")).toBeTruthy();
    expect(screen.getByText("Kategorisierung")).toBeTruthy();
  });

  it("sollte im Stacked-Layout kein horizontales Raster verwenden", () => {
    const { container } = renderPanel("stacked");
    expect(container.querySelector(".md\\:grid-cols-3")).toBeNull();
    expect(screen.getByText("Kategorisierung")).toBeTruthy();
  });
});
