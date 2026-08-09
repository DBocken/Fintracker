import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import type { Account, Category, Transaction } from "@/types";
import { asTransactionId } from "@/lib/ids";

// --- Fixtures ---------------------------------------------------------------
const CATS: Category[] = [
  { id: "food", name: "Lebensmittel", parent_id: null } as Category,
  { id: "rent", name: "Wohnen", parent_id: null } as Category,
];
const ACCOUNTS: Account[] = [
  { id: "giro", name: "Girokonto", color: "#3b82f6", icon: "🏦", is_budget_pool_member: true, opening_balance: 0 } as Account,
];
const TXS: Transaction[] = [
  { id: asTransactionId("t1"), date: "2026-07-03", amount: -23.4, payee: "Lieferando", category_id: "food", description: "", original_text: "", auto_mapped: false, confirmed: true, account_id: "giro" },
  { id: asTransactionId("t2"), date: "2026-07-02", amount: -41.17, payee: "Rewe", category_id: "food", description: "", original_text: "", auto_mapped: false, confirmed: true, account_id: "giro" },
  { id: asTransactionId("t3"), date: "2026-07-01", amount: -890, payee: "Miete Wohnung", category_id: "rent", description: "", original_text: "", auto_mapped: false, confirmed: true, account_id: "giro" },
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

vi.mock("@/components/providers/GentleModeProvider", () => ({ useGentleMode: () => ({ enabled: false }) }));
vi.mock("@/hooks/usePersistedSet", () => ({ usePersistedSet: () => [new Set(), vi.fn()] }));
vi.mock("@/hooks/useTransactionDetailEditing", () => ({
  useTransactionDetailEditing: () => ({ save: vi.fn(), isPending: false }),
}));
vi.mock("@/components/dashboard/TransactionDetailsModal", () => ({ TransactionDetailsModal: () => null }));
vi.mock("@/components/transactions/TransactionFormDialog", () => ({ TransactionFormDialog: () => null }));

import TransactionsPage from "../TransactionsPage";

function renderPage(initialUrl = "/transactions", locale: "de" | "en" = "de") {
  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <TransactionsPage />
      </MemoryRouter>
    </I18nProvider>,
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

    it("[REGRESSION] sollte die Filter-Bedienelemente sichtbar auf der Seite rendern", () => {
      renderPage();
      // Die Filter liegen direkt sichtbar auf der Seite (nicht hinter einem Button).
      expect(screen.getByRole("combobox", { name: /Konto filtern/i })).toBeTruthy();
      expect(screen.getByRole("combobox", { name: /Kategorie filtern/i })).toBeTruthy();
      expect(screen.getByRole("combobox", { name: /Vertragsstatus filtern/i })).toBeTruthy();
      expect(screen.getByRole("combobox", { name: /Essenziell-Status filtern/i })).toBeTruthy();
      expect(screen.getByRole("combobox", { name: /Ausgabenklasse filtern/i })).toBeTruthy();
      expect(screen.getByRole("combobox", { name: /Zeitraum filtern/i })).toBeTruthy();
    });

    it("[REGRESSION] sollte beim Tippen in die Suche Liste UND Kennzahlen anpassen", async () => {
      renderPage();
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Rewe" } });

      // Das Filtern ist jetzt debounced (300 ms) — die Liste UND die Kennzahlen
      // folgen nach dem Debounce (Intent unverändert, nur nicht mehr synchron).
      await waitFor(() => {
        expect(screen.queryByText("Lieferando")).toBeNull();
      });
      expect(screen.getByText("Rewe")).toBeTruthy();
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

  describe("i18n Compliance", () => {
    it("sollte englische Filter-Bedienelemente rendern", () => {
      renderPage("/transactions", "en");
      // Verify filter labels are displayed in English
      expect(screen.getByRole("combobox", { name: /Filter by account/i })).toBeTruthy();
      expect(screen.getByRole("combobox", { name: /Filter by category/i })).toBeTruthy();
      expect(screen.getByRole("combobox", { name: /Filter by contract status/i })).toBeTruthy();
      expect(screen.getByRole("combobox", { name: /Filter by essential status/i })).toBeTruthy();
      expect(screen.getByRole("combobox", { name: /Filter by expense class/i })).toBeTruthy();
      expect(screen.getByRole("combobox", { name: /Filter by time range/i })).toBeTruthy();
    });
  });
});
