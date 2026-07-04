import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReviewTable } from "../ReviewTable";
import type { Transaction } from "../../types";

vi.mock("@/services/transaction-service", () => ({
  getHierarchicalCategories: vi.fn().mockResolvedValue([]),
  getTransactions: vi.fn().mockResolvedValue([]),
  saveTransactions: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/services/account-service", () => ({
  getAccounts: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/services/contract-detection-service", () => ({
  applyDetectedContracts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/gocardless-sync-service", () => ({
  reconcileAllInternalTransfers: vi.fn().mockResolvedValue(undefined),
}));

function makeTransactions(count: number): Transaction[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `tx-${i}`,
    account_id: "acc-1",
    date: "2026-06-01",
    amount: -10 - i,
    payee: `Empfänger ${i}`,
    description: `Buchung ${i}`,
    original_text: `Buchung ${i}`,
    auto_mapped: false,
    confirmed: false,
  }));
}

function renderReviewTable(transactions: Transaction[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // Query-Cache vorbefüllen: ReviewTable destrukturiert `data` mit
  // `= []`-Fallback. Bliebe `data` beim ersten Render `undefined`, würde
  // dieser Fallback bei jedem Render ein NEUES Array liefern, was über
  // duplicateIds -> useEffect -> setExcludedIds eine Render-Schleife
  // erzeugt, die sich in RTLs synchronem act() nicht mehr von selbst auflöst
  // ([REGRESSION]-relevant: siehe Testfall unten). Mit vorbefüllter Cache ist
  // `data` von Anfang an ein stabiles Array.
  queryClient.setQueryData(['accounts'], []);
  queryClient.setQueryData(['hierarchical-categories'], []);
  queryClient.setQueryData(['transactions', 'all-for-duplicate-check'], []);
  return render(
    <QueryClientProvider client={queryClient}>
      <ReviewTable transactions={transactions} onConfirm={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("ReviewTable Pagination A11y", () => {
  // Mehr als PAGE_SIZE (50) Zeilen, damit die Pagination sichtbar ist.
  describe("Normal Behavior", () => {
    it("sollte alle vier Pagination-Buttons mit deutschem aria-label als zugänglichem Namen anbieten", async () => {
      renderReviewTable(makeTransactions(51));

      const erste = await screen.findByRole("button", { name: "Erste Seite" });
      const vorherige = screen.getByRole("button", { name: "Vorherige Seite" });
      const naechste = screen.getByRole("button", { name: "Nächste Seite" });
      const letzte = screen.getByRole("button", { name: "Letzte Seite" });

      // aria-label muss explizit gesetzt sein (nicht nur title als Fallback).
      expect(erste).toHaveAttribute("aria-label", "Erste Seite");
      expect(vorherige).toHaveAttribute("aria-label", "Vorherige Seite");
      expect(naechste).toHaveAttribute("aria-label", "Nächste Seite");
      expect(letzte).toHaveAttribute("aria-label", "Letzte Seite");
    });

    it("sollte auf Seite 1 die Zurück-Buttons deaktivieren und die Vorwärts-Buttons aktivieren", async () => {
      renderReviewTable(makeTransactions(51));

      expect(await screen.findByRole("button", { name: "Erste Seite" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Vorherige Seite" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Nächste Seite" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Letzte Seite" })).toBeEnabled();
    });
  });

  describe("Edge Cases", () => {
    it("sollte ohne zweite Seite keine Pagination-Buttons rendern", async () => {
      renderReviewTable(makeTransactions(3));

      // Tabelle ist da, aber keine Pagination nötig.
      expect(await screen.findByText("Transaktionen prüfen")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Nächste Seite" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Erste Seite" })).not.toBeInTheDocument();
    });
  });
});
