import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import type { Account, Category, Transaction } from "@/types";

const CATS: Category[] = [{ id: "food", name: "Lebensmittel", parent_id: null } as Category];
const ACCOUNTS: Account[] = [
  { id: "giro", name: "Girokonto", color: "#3b82f6", icon: "🏦", is_budget_pool_member: true, opening_balance: 0 } as Account,
];
const TXS: Transaction[] = [
  { id: "t1", date: "2026-07-03", amount: -23.4, payee: "Lieferando", category_id: "food", description: "", original_text: "", auto_mapped: false, confirmed: true, account_id: "giro" },
];

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
// Leichtgewichtige Stubs für die Verdrahtung (ohne die schweren Detail-Abhängigkeiten).
vi.mock("@/components/dashboard/TransactionDetailsModal", () => ({
  TransactionDetailsModal: ({ open }: { open: boolean }) => (open ? <div data-testid="overlay-modal" /> : null),
}));
vi.mock("@/components/dashboard/TransactionDetailsPanel", () => ({
  TransactionDetailsPanel: ({ transaction }: { transaction: { payee: string } }) => (
    <div data-testid="inline-panel">Inline: {transaction.payee}</div>
  ),
}));

import TransactionsPage from "./TransactionsPage";

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

afterEach(() => {
  // @ts-expect-error – Test-Cleanup.
  delete window.matchMedia;
});

function renderPage(locale: "de" | "en" = "de") {
  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter initialEntries={["/transactions"]}>
        <TransactionsPage />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("TransactionsPage – Master-Detail", () => {
  describe("Wide-Desktop (lg+)", () => {
    beforeEach(() => mockMatchMedia(true));

    it("sollte zunächst den Platzhalter statt Overlay zeigen", () => {
      renderPage();
      expect(screen.getByText(/Wähle links eine Buchung/)).toBeTruthy();
      expect(screen.queryByTestId("overlay-modal")).toBeNull();
    });

    it("[REGRESSION] sollte Details inline im rechten Panel öffnen (kein Overlay)", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /Lieferando/i }));
      expect(screen.getByTestId("inline-panel")).toBeTruthy();
      expect(screen.getByText(/Inline: Lieferando/)).toBeTruthy();
      expect(screen.queryByTestId("overlay-modal")).toBeNull();
    });
  });

  describe("Schmaler Screen (< lg)", () => {
    beforeEach(() => mockMatchMedia(false));

    it("[REGRESSION] sollte Details als Overlay/Sheet öffnen", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /Lieferando/i }));
      expect(screen.getByTestId("overlay-modal")).toBeTruthy();
    });
  });

  describe("i18n Compliance", () => {
    it("sollte den Platzhalter-Hinweis auf Englisch rendern (Master-Detail-Layout)", () => {
      mockMatchMedia(true);
      renderPage("en");
      // Echter übersetzter Text statt eines sprachneutralen Payee-Namens —
      // beweist, dass die englische Übersetzung tatsächlich gerendert wird.
      expect(screen.getByText(/Select a transaction on the left to see and edit its details\./)).toBeTruthy();
      // Clicking on a transaction should show the detail panel
      fireEvent.click(screen.getByRole("button", { name: /Lieferando/i }));
      expect(screen.getByTestId("inline-panel")).toBeTruthy();
    });
  });
});
