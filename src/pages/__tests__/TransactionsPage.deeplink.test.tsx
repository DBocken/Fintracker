import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, afterEach } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import type { Account, Category, Transaction } from "@/types";

const CATS: Category[] = [{ id: "food", name: "Lebensmittel", parent_id: null } as Category];
const ACCOUNTS: Account[] = [
  { id: "giro", name: "Girokonto", color: "#3b82f6", icon: "🏦", is_budget_pool_member: true, opening_balance: 0 } as Account,
];
const TXS: Transaction[] = [
  { id: "t1", date: "2026-07-03", amount: -23.4, payee: "Lieferando", category_id: "food", description: "", original_text: "", auto_mapped: false, confirmed: true, account_id: "giro" },
  { id: "t2", date: "2026-07-02", amount: -1800, payee: "Malerbetrieb", category_id: "food", description: "", original_text: "", auto_mapped: false, confirmed: true, account_id: "giro" },
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
vi.mock("@/components/dashboard/TransactionDetailsModal", () => ({
  TransactionDetailsModal: ({ open }: { open: boolean }) => (open ? <div data-testid="overlay-modal" /> : null),
}));
vi.mock("@/components/dashboard/TransactionDetailsPanel", () => ({
  TransactionDetailsPanel: ({ transaction }: { transaction: { payee: string } }) => (
    <div data-testid="inline-panel">Inline: {transaction.payee}</div>
  ),
}));

import TransactionsPage from "../TransactionsPage";

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

function renderPage(entry: string) {
  return render(
    <I18nProvider initialLocale="de">
      <MemoryRouter initialEntries={[entry]}>
        <TransactionsPage />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("TransactionsPage – Deep-Link (?tx=<id>)", () => {
  it("sollte die verlinkte Buchung automatisch im Inline-Panel öffnen (Desktop)", () => {
    mockMatchMedia(true);
    renderPage("/transactions?tx=t2");
    expect(screen.getByTestId("inline-panel")).toBeTruthy();
    expect(screen.getByText(/Inline: Malerbetrieb/)).toBeTruthy();
  });

  it("sollte die verlinkte Buchung auf schmalen Screens als Overlay öffnen", () => {
    mockMatchMedia(false);
    renderPage("/transactions?tx=t2");
    expect(screen.getByTestId("overlay-modal")).toBeTruthy();
  });

  it("[REGRESSION] sollte bei unbekannter ID nichts öffnen (Platzhalter bleibt)", () => {
    mockMatchMedia(true);
    renderPage("/transactions?tx=gibt-es-nicht");
    expect(screen.queryByTestId("inline-panel")).toBeNull();
    expect(screen.getByText(/Wähle links eine Buchung/)).toBeTruthy();
  });

  it("[REGRESSION] sollte ohne ?tx keinen Auto-Open auslösen", () => {
    mockMatchMedia(true);
    renderPage("/transactions");
    expect(screen.queryByTestId("inline-panel")).toBeNull();
  });
});
