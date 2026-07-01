import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { HouseholdSplitPanel } from "../HouseholdSplitPanel";
import type { Transaction } from "@/types";

const mocks = vi.hoisted(() => ({
  getHouseholds: vi.fn(),
  getHouseholdMembers: vi.fn(),
  getSharedExpenseSplit: vi.fn(),
  upsertSharedExpenseSplit: vi.fn(),
  deleteSharedExpenseSplit: vi.fn(),
}));

vi.mock("@/services/household-service", () => ({
  getHouseholds: mocks.getHouseholds,
  getHouseholdMembers: mocks.getHouseholdMembers,
  getSharedExpenseSplit: mocks.getSharedExpenseSplit,
  upsertSharedExpenseSplit: mocks.upsertSharedExpenseSplit,
  deleteSharedExpenseSplit: mocks.deleteSharedExpenseSplit,
  splitEqually: (amount: number, ids: string[]) =>
    ids.map((member_id) => ({ member_id, amount: amount / ids.length })),
}));

const tx = { id: "t1", amount: -10, date: "2026-01-01" } as Transaction;

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HouseholdSplitPanel transaction={tx} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("HouseholdSplitPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getHouseholdMembers.mockResolvedValue([]);
    mocks.getSharedExpenseSplit.mockResolvedValue(null);
  });

  it("sollte ohne Haushalt zum Anlegen auffordern", async () => {
    mocks.getHouseholds.mockResolvedValue([]);
    renderPanel();
    expect(await screen.findByText(/Lege zuerst einen Haushalt/)).toBeInTheDocument();
  });

  it("sollte einen bestehenden Split mit Mitgliedern und Anteilen anzeigen", async () => {
    mocks.getHouseholds.mockResolvedValue([{ id: "h1", name: "WG" }]);
    mocks.getSharedExpenseSplit.mockResolvedValue({
      id: "s1",
      transaction_id: "t1",
      household_id: "h1",
      shares: [
        { member_id: "m1", amount: 6 },
        { member_id: "m2", amount: 4 },
      ],
    });
    mocks.getHouseholdMembers.mockResolvedValue([
      { id: "m1", household_id: "h1", name: "Anna" },
      { id: "m2", household_id: "h1", name: "Ben" },
    ]);

    renderPanel();

    expect(await screen.findByLabelText("Anteil Anna")).toHaveValue("6.00");
    expect(screen.getByLabelText("Anteil Ben")).toHaveValue("4.00");
    expect(screen.getByRole("button", { name: "Aufteilung speichern" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aufteilung entfernen" })).toBeInTheDocument();
  });
});
