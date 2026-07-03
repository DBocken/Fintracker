import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import type { Account, Category, Transaction } from "@/types";

// --- Fixtures ---------------------------------------------------------------
const CATS: Category[] = [
  { id: "food", name: "Lebensmittel", parent_id: null } as Category,
  { id: "rent", name: "Wohnen", parent_id: null } as Category,
];
const ACCOUNTS: Account[] = [
  { id: "giro", name: "Girokonto", color: "#3b82f6", icon: "🏦", is_budget_pool_member: true, opening_balance: 0 } as Account,
];
const TXS: Transaction[] = [
  { id: "t1", date: "2026-07-03", amount: -23.4, payee: "Lieferando", category_id: "food", description: "", original_text: "", auto_mapped: false, confirmed: true, account_id: "giro" },
  { id: "t2", date: "2026-07-02", amount: -41.17, payee: "Rewe", category_id: "food", description: "", original_text: "", auto_mapped: false, confirmed: true, account_id: "giro" },
  { id: "t3", date: "2026-07-01", amount: -890, payee: "Miete Wohnung", category_id: "rent", description: "", original_text: "", auto_mapped: false, confirmed: true, account_id: "giro" },
];

// --- Mocks ------------------------------------------------------------------
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    const key = queryKey[0];
    if (key === "transactions") return { data: TXS, isLoading: false };
    if (key === "categories") return { data: CATS };
    if (key === "accounts") return { data: ACCOUNTS };
    if (key === "contract-decisions") return { data: new Map() };
    return { data: undefined };
  },
}));

vi.mock("@/i18n/useI18n", () => ({ useI18n: () => ({ t: (_k: string, f?: string) => f ?? _k, locale: "de" }) }));
vi.mock("@/components/providers/GentleModeProvider", () => ({ useGentleMode: () => ({ enabled: false }) }));
vi.mock("@/hooks/usePersistedSet", () => ({ usePersistedSet: () => [new Set(), vi.fn()] }));
vi.mock("@/hooks/useTransactionDetailEditing", () => ({
  useTransactionDetailEditing: () => ({ save: vi.fn(), isPending: false }),
}));
vi.mock("@/components/dashboard/TransactionDetailsModal", () => ({ TransactionDetailsModal: () => null }));
vi.mock("@/components/transactions/TransactionFormDialog", () => ({ TransactionFormDialog: () => null }));

import TransactionsPage from "./TransactionsPage";

function renderPage(initialUrl = "/transactions") {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <TransactionsPage />
    </MemoryRouter>,
  );
}

describe("TransactionsPage – Filter steuern alle Anzeigen", () => {
  describe("Normal Behavior", () => {
    it("sollte ohne Filter alle Buchungen und den Gesamt-Zähler zeigen", () => {
      renderPage();
      expect(screen.getByText("Lieferando")).toBeTruthy();
      expect(screen.getByText("Rewe")).toBeTruthy();
      expect(screen.getByText("Miete Wohnung")).toBeTruthy();
      // Kennzahlen-Zähler „3 von 3".
      expect(screen.getByText(/von 3/)).toBeTruthy();
    });

    it("[REGRESSION] sollte beim Tippen in die Suche Liste UND Kennzahlen anpassen", () => {
      renderPage();
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Rewe" } });

      expect(screen.getByText("Rewe")).toBeTruthy();
      expect(screen.queryByText("Lieferando")).toBeNull();
      expect(screen.queryByText("Miete Wohnung")).toBeNull();
      // Kennzahlen zählen jetzt nur die gefilterte Buchung.
      const count = screen.getByText(/von 3/).closest("dd");
      expect(within(count as HTMLElement).getByText("1")).toBeTruthy();
    });
  });

  describe("Deep-Link vom Dashboard", () => {
    it("[REGRESSION] sollte Filter aus der URL anwenden (Kategorie)", () => {
      renderPage("/transactions?cat=rent");
      expect(screen.getByText("Miete Wohnung")).toBeTruthy();
      expect(screen.queryByText("Lieferando")).toBeNull();
      expect(screen.queryByText("Rewe")).toBeNull();
    });
  });
});
