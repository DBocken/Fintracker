import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
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

vi.mock("@/i18n/useI18n", () => ({ useI18n: () => ({ t: (_k: string, f?: string) => f ?? _k, locale: "de" }) }));
vi.mock("@/components/providers/GentleModeProvider", () => ({ useGentleMode: () => ({ enabled: false }) }));
vi.mock("@/hooks/usePersistedSet", () => ({ usePersistedSet: () => [new Set(), vi.fn()] }));
vi.mock("@/hooks/useTransactionDetailEditing", () => ({
  useTransactionDetailEditing: () => ({ save: vi.fn(), isPending: false }),
}));
// Leichtgewichtiger Stub, damit die Verdrahtung ohne die schweren Detail-
// Abhängigkeiten testbar bleibt.
vi.mock("@/components/dashboard/TransactionDetailsModal", () => ({
  TransactionDetailsModal: ({ open }: { open: boolean }) => (open ? <div data-testid="details-modal" /> : null),
}));

import TransactionsPage from "./TransactionsPage";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/transactions"]}>
      <TransactionsPage />
    </MemoryRouter>,
  );
}

describe("TransactionsPage – Detail öffnen", () => {
  it("sollte anfangs kein Detail-Dialog zeigen", () => {
    renderPage();
    expect(screen.queryByTestId("details-modal")).toBeNull();
  });

  it("[REGRESSION] sollte beim Klick auf eine Zeile den Detail-Dialog öffnen", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Lieferando/i }));
    expect(screen.getByTestId("details-modal")).toBeTruthy();
  });
});
