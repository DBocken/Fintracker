import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Account } from "../../../types";

// FeatureGate (verschachtelt via RequireTier) liest Tier/Auth – beide werden
// gemockt, damit kein echter AuthProvider/Supabase nötig ist (Muster wie in
// src/components/__tests__/FeatureGate.test.tsx).
vi.mock("@/hooks/useTier", () => ({ useTier: () => "free" }));
vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ status: "authenticated" }),
}));

// GoCardlessConnect/TransferSuggestions laden eigene Daten (Institute,
// Transfer-Kandidaten) – für den A11y-Test der Konten-Aktions-Buttons sind
// sie irrelevant und werden durch einfache Platzhalter ersetzt.
vi.mock("../../GoCardlessConnect", () => ({
  GoCardlessConnect: () => <div data-testid="gocardless-connect-stub" />,
}));
vi.mock("../TransferSuggestions", () => ({
  TransferSuggestions: () => <div data-testid="transfer-suggestions-stub" />,
}));

vi.mock("../../../services/account-service", async () => {
  const actual = await vi.importActual<typeof import("../../../services/account-service")>(
    "../../../services/account-service",
  );
  return {
    ...actual,
    getAccounts: vi.fn(),
    canCreateAccount: vi.fn().mockResolvedValue({ allowed: true, current: 2, limit: 10 }),
    createAccount: vi.fn(),
    updateAccount: vi.fn(),
    deleteAccount: vi.fn(),
  };
});

vi.mock("../../../services/gocardless-sync-service", async () => {
  const actual = await vi.importActual<typeof import("../../../services/gocardless-sync-service")>(
    "../../../services/gocardless-sync-service",
  );
  return {
    ...actual,
    getAccountConsentStatus: vi.fn().mockResolvedValue({ expired: false }),
    canSyncAccount: vi.fn().mockReturnValue({ canSync: true }),
    syncAccountTransactions: vi.fn(),
    disconnectGoCardlessAccount: vi.fn(),
    reconcileAllInternalTransfers: vi.fn().mockResolvedValue(undefined),
  };
});

import { AccountManager } from "../AccountManager";
import { getAccounts } from "../../../services/account-service";

function makeAccount(partial: Partial<Account> & { id: string; name: string }): Account {
  return {
    user_id: "local",
    type: "checking",
    currency: "EUR",
    color: "#3366ff",
    icon: "🏦",
    is_budget_pool_member: false,
    order_index: 0,
    ...partial,
  };
}

function renderManager() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AccountManager />
    </QueryClientProvider>,
  );
}

describe("AccountManager Konten-Aktions-Buttons A11y", () => {
  beforeEach(() => {
    vi.mocked(getAccounts).mockReset();
  });

  describe("Normal Behavior", () => {
    it("sollte für ein manuelles Konto Bearbeiten- und Löschen-Buttons mit deutschem aria-label anbieten", async () => {
      vi.mocked(getAccounts).mockResolvedValue([
        makeAccount({ id: "acc-manual", name: "Bargeld" }),
      ]);
      renderManager();

      const bearbeiten = await screen.findByRole("button", { name: "Konto bearbeiten" });
      const loeschen = screen.getByRole("button", { name: "Konto löschen" });

      expect(bearbeiten).toHaveAttribute("aria-label", "Konto bearbeiten");
      expect(loeschen).toHaveAttribute("aria-label", "Konto löschen");
    });

    it("sollte für ein verbundenes GoCardless-Konto Sync- und Trennen-Buttons mit deutschem aria-label anbieten", async () => {
      vi.mocked(getAccounts).mockResolvedValue([
        makeAccount({ id: "acc-bank", name: "Girokonto", gocardless_account_id: "gc-1" }),
      ]);
      renderManager();

      const sync = await screen.findByRole("button", { name: "Transaktionen synchronisieren" });
      const trennen = screen.getByRole("button", { name: "Bankverbindung trennen" });

      expect(sync).toHaveAttribute("aria-label", "Transaktionen synchronisieren");
      expect(trennen).toHaveAttribute("aria-label", "Bankverbindung trennen");
    });

    it("sollte den title als Tooltip zusätzlich zum aria-label behalten", async () => {
      vi.mocked(getAccounts).mockResolvedValue([
        makeAccount({ id: "acc-manual", name: "Bargeld" }),
      ]);
      renderManager();

      const bearbeiten = await screen.findByRole("button", { name: "Konto bearbeiten" });
      expect(bearbeiten).toHaveAttribute("title", "Konto bearbeiten");
    });
  });

  describe("Edge Cases", () => {
    it("sollte für ein verbundenes Konto keinen separaten Löschen-Button zeigen (stattdessen Trennen)", async () => {
      vi.mocked(getAccounts).mockResolvedValue([
        makeAccount({ id: "acc-bank", name: "Girokonto", gocardless_account_id: "gc-1" }),
      ]);
      renderManager();

      await screen.findByRole("button", { name: "Bankverbindung trennen" });
      expect(screen.queryByRole("button", { name: "Konto löschen" })).not.toBeInTheDocument();
    });
  });
});
