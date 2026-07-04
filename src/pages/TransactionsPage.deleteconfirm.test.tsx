import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Account, Category, Transaction } from "@/types";

// --- Fixtures ---------------------------------------------------------------
const CATS: Category[] = [{ id: "food", name: "Lebensmittel", parent_id: null } as Category];
const ACCOUNTS: Account[] = [
  { id: "giro", name: "Girokonto", color: "#3b82f6", icon: "🏦", is_budget_pool_member: true, opening_balance: 0 } as Account,
];
const TXS: Transaction[] = [
  { id: "t1", date: "2026-07-03", amount: -23.4, payee: "Lieferando", category_id: "food", description: "", original_text: "", auto_mapped: false, confirmed: true, account_id: "giro" },
];

// --- Mocks ------------------------------------------------------------------
const { deleteMutate } = vi.hoisted(() => ({ deleteMutate: vi.fn() }));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: deleteMutate, isPending: false }),
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
vi.mock("@/components/transactions/TransactionFormDialog", () => ({ TransactionFormDialog: () => null }));

// Leichtgewichtige Stubs: bilden exakt den echten Lösch-Klickpfad nach
// (onDelete(id) gefolgt von onClose), ohne die schweren Detail-Abhängigkeiten.
vi.mock("@/components/dashboard/TransactionDetailsPanel", () => ({
  TransactionDetailsPanel: ({
    transaction,
    onDelete,
    onClose,
  }: {
    transaction: { id?: string };
    onDelete?: (id: string) => void;
    onClose: () => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        if (transaction.id && onDelete) onDelete(transaction.id);
        onClose();
      }}
    >
      Panel-Löschen
    </button>
  ),
}));
vi.mock("@/components/dashboard/TransactionDetailsModal", () => ({
  TransactionDetailsModal: ({
    open,
    transaction,
    onDelete,
  }: {
    open: boolean;
    transaction: { id?: string } | null;
    onDelete?: (id: string) => void;
  }) =>
    open ? (
      <button type="button" onClick={() => transaction?.id && onDelete?.(transaction.id)}>
        Modal-Löschen
      </button>
    ) : null,
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

beforeEach(() => {
  deleteMutate.mockClear();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/transactions"]}>
      <TransactionsPage />
    </MemoryRouter>,
  );
}

/** Öffnet das Detail-Panel (Desktop) und klickt dort auf Löschen. */
function clickPanelDelete() {
  fireEvent.click(screen.getByRole("button", { name: /Lieferando/i }));
  fireEvent.click(screen.getByRole("button", { name: "Panel-Löschen" }));
}

describe("TransactionsPage – Löschbestätigung (Issue #175 Punkt 6)", () => {
  describe("Desktop-Panel-Pfad (lg+)", () => {
    beforeEach(() => mockMatchMedia(true));

    it("[REGRESSION] sollte beim Klick auf Löschen NICHT sofort löschen, sondern den Bestätigungsdialog zeigen", () => {
      renderPage();
      clickPanelDelete();

      expect(deleteMutate).not.toHaveBeenCalled();
      expect(screen.getByText("Löschen bestätigen")).toBeTruthy();
    });

    it("sollte erst nach Bestätigung genau einmal löschen", () => {
      renderPage();
      clickPanelDelete();

      fireEvent.click(screen.getByRole("button", { name: "Löschen" }));

      expect(deleteMutate).toHaveBeenCalledTimes(1);
      expect(deleteMutate).toHaveBeenCalledWith("t1");
    });

    it("sollte bei Abbrechen nichts löschen und die Buchung behalten", () => {
      renderPage();
      clickPanelDelete();

      fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

      expect(deleteMutate).not.toHaveBeenCalled();
      expect(screen.queryByText("Löschen bestätigen")).toBeNull();
      expect(screen.getByText("Lieferando")).toBeTruthy();
    });
  });

  describe("Overlay/Sheet-Pfad (< lg)", () => {
    beforeEach(() => mockMatchMedia(false));

    it("[REGRESSION] sollte auch im Overlay erst den Bestätigungsdialog zeigen und dann löschen", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /Lieferando/i }));
      fireEvent.click(screen.getByRole("button", { name: "Modal-Löschen" }));

      expect(deleteMutate).not.toHaveBeenCalled();
      expect(screen.getByText("Löschen bestätigen")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Löschen" }));
      expect(deleteMutate).toHaveBeenCalledTimes(1);
      expect(deleteMutate).toHaveBeenCalledWith("t1");
    });
  });
});
