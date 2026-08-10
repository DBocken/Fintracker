/**
 * WP 1.2b — die Integritätsmeldung erreicht die Fläche.
 *
 * `data-integrity-report.ts` (WP 1.2 Teil A) zählt beim Lesen der Buchungen
 * (`transaction-storage-service.getLocalTransactions`) übersprungene,
 * beschädigte Items — bis hierher stand die Zahl nur im Speicher, niemand
 * rief `getIntegrityReport()` von der Fläche aus auf. Dieser Test prüft die
 * VERDRAHTUNG bis zur Buchungsseite: Ein realer Eintrag im Bericht muss auf
 * `/transactions` als Warnung mit Zahl und Handlungsoption sichtbar werden —
 * und wieder verschwinden, sobald der Bericht sauber ist (kein Dauerbanner).
 *
 * Bewusst KEIN Fehlerzustand: die Buchungen selbst laden erfolgreich
 * (`state.txs` ist nicht leer) — `FinanceErrorState` würde hier fälschlich
 * funktionierende Daten verstecken.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import type { Account, Category, Transaction } from "@/types";
import { asTransactionId } from "@/lib/ids";
import { recordSkipped, clearIntegrityReport } from "@/services/data-integrity-report";

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
  TransactionDetailsPanel: () => null,
}));

import TransactionsPage from "../TransactionsPage";

afterEach(() => {
  clearIntegrityReport();
});

beforeEach(() => {
  clearIntegrityReport();
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

describe("TransactionsPage — Integritätsmeldung (WP 1.2b)", () => {
  it("[ZUSTAND /transactions:geladen] sollte die Anzahl übersprungener Buchungen und eine Handlungsoption zeigen", () => {
    recordSkipped("transactions", 3);
    renderPage();

    expect(screen.getByText("3 Einträge konnten nicht gelesen werden.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Backup prüfen" })).toBeInTheDocument();
  });

  it("sollte die Meldung auch auf Englisch zeigen", () => {
    recordSkipped("transactions", 2);
    renderPage("en");

    expect(screen.getByText("2 entries could not be read.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Check backup" })).toBeInTheDocument();
  });

  it("[ZUSTAND /transactions:geladen] sollte KEINE Meldung zeigen, wenn nichts übersprungen wurde", () => {
    // Kein recordSkipped() — sauberer Bericht (Gegenprobe, kein Dauerbanner).
    renderPage();

    expect(screen.queryByText(/konnten nicht gelesen werden/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Backup prüfen" })).toBeNull();
  });
});
