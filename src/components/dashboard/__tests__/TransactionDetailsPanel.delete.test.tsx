import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import type { Category, Transaction } from "@/types";
import { I18nProvider } from "@/i18n/I18nProvider";

// Gleiche Mock-Basis wie die übrigen Panel-Tests (useQuery liefert leere
// Allocations; teure/IO-Bausteine werden gestubbt).
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

import { TransactionDetailsPanel } from "../TransactionDetailsPanel";

const CATS: Category[] = [{ id: "food", name: "Lebensmittel", parent_id: null } as Category];
const TX: Transaction = {
  id: "t1",
  date: "2026-07-02",
  amount: -117.6,
  payee: "Santander",
  description: "",
  original_text: "",
  category_id: "food",
  auto_mapped: false,
  confirmed: true,
};

function renderPanel(opts: {
  locale?: "de" | "en";
  onDelete?: (id: string) => void;
  onClose?: () => void;
}) {
  return render(
    <I18nProvider initialLocale={opts.locale ?? "de"}>
      <MemoryRouter>
        <TransactionDetailsPanel
          transaction={TX}
          categories={CATS}
          accounts={[]}
          allTransactions={[TX]}
          onSave={vi.fn()}
          onClose={opts.onClose ?? vi.fn()}
          onDelete={opts.onDelete ?? vi.fn()}
        />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("TransactionDetailsPanel – Löschabsicherung (#175)", () => {
  it("sollte beim Klick auf Löschen NICHT sofort löschen, sondern einen Bestätigungsdialog öffnen", async () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    renderPanel({ onDelete, onClose });

    await userEvent.click(screen.getByRole("button", { name: "Löschen" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Löschen bestätigen")).toBeTruthy();
  });

  it("sollte nach Bestätigung onDelete mit der id aufrufen und schließen", async () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    renderPanel({ onDelete, onClose });

    await userEvent.click(screen.getByRole("button", { name: "Löschen" }));
    const dialog = screen.getByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Löschen" }));

    expect(onDelete).toHaveBeenCalledWith("t1");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sollte bei Abbrechen weder löschen noch schließen", async () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    renderPanel({ onDelete, onClose });

    await userEvent.click(screen.getByRole("button", { name: "Löschen" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Abbrechen" }),
    );

    expect(onDelete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("sollte den Bestätigungsdialog auch auf Englisch rendern (bilingual)", async () => {
    const onDelete = vi.fn();
    renderPanel({ locale: "en", onDelete });

    // Der Auslöse-Button trägt aktuell festen Text „Löschen" (vorbestehend);
    // der Dialog selbst ist i18n-geführt.
    await userEvent.click(screen.getByRole("button", { name: "Löschen" }));
    expect(screen.getByText("Confirm deletion")).toBeTruthy();

    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );
    expect(onDelete).toHaveBeenCalledWith("t1");
  });
});
