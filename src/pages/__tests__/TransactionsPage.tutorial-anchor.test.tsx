import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import type { Account, Category, Transaction } from "@/types";
import { asTransactionId } from "@/lib/ids";

const CATS: Category[] = [{ id: "food", name: "Lebensmittel", parent_id: null } as Category];
const ACCOUNTS: Account[] = [
  { id: "giro", name: "Girokonto", color: "#3b82f6", icon: "🏦", is_budget_pool_member: true, opening_balance: 0 } as Account,
];
const TXS: Transaction[] = [
  { id: asTransactionId("t1"), date: "2026-07-03", amount: -23.4, payee: "Lieferando", category_id: "food", description: "", original_text: "", auto_mapped: false, confirmed: true, account_id: "giro" },
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

/**
 * [REGRESSION] Der Tour-Anker `transactions-list` (Kapitel `transactions`,
 * Schritt `overview`, `tutorial-steps.ts`) lag vorher auf dem GESAMTEN
 * Grid der Seite (Liste + Detail-Panel, potenziell tausende Pixel hoch) —
 * `scrollIntoView({block: 'center'})` zentrierte dieses hohe Element und
 * landete damit fast am Seitenende statt oben, wo der erklärte Inhalt
 * (Suche/Filter/Kennzahlen) tatsächlich steht.
 */
describe("TransactionsPage — Tour-Anker der Buchungsliste", () => {
  it("[REGRESSION] sollte den Anker auf Suche/Filter/Kennzahlen begrenzen statt auf die ganze Tagesliste", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/transactions"]}>
        <I18nProvider>
          <TransactionsPage />
        </I18nProvider>
      </MemoryRouter>,
    );

    const anchor = container.querySelector('[data-tour-id="transactions-list"]');
    expect(anchor).not.toBeNull();

    // Die Suche liegt im Anker …
    expect(anchor?.querySelector('[data-tour-id="transactions-search"]')).not.toBeNull();
    // … die erste Buchungszeile der (potenziell langen) Tagesliste dagegen
    // nicht mehr. Läge sie noch darin, wäre der Anker wieder so hoch wie die
    // ganze Liste.
    expect(anchor?.querySelector('[data-tour-id="transactions-first-row"]')).toBeNull();
  });
});
