import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCoachOverview } from "@/hooks/data/useCoachOverview";

const mocks = vi.hoisted(() => ({
  getCoachOverview: vi.fn(),
  getFinancialHealth: vi.fn(),
  evaluateMilestones: vi.fn(),
  getTransactions: vi.fn(),
  getDebts: vi.fn(),
  getReceivables: vi.fn(),
}));

vi.mock("@/services/coach-service", () => ({ getCoachOverview: mocks.getCoachOverview }));
vi.mock("@/services/financial-health-service", () => ({ getFinancialHealth: mocks.getFinancialHealth }));
vi.mock("@/services/milestones-service", () => ({ evaluateMilestones: mocks.evaluateMilestones }));
vi.mock("@/services/transaction-service", () => ({ getTransactions: mocks.getTransactions }));
vi.mock("@/services/debt-service", () => ({ getDebts: mocks.getDebts }));
vi.mock("@/services/receivable-service", () => ({ getReceivables: mocks.getReceivables }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useCoachOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Normal Behavior", () => {
    it("sollte die gemappten Coach-Daten liefern", async () => {
      mocks.getCoachOverview.mockResolvedValue({ recommendations: [{ id: "r1" }] });
      mocks.getFinancialHealth.mockResolvedValue({ score: 72 });
      mocks.evaluateMilestones.mockResolvedValue([{ id: "m1" }]);
      mocks.getTransactions.mockResolvedValue([{ id: "t1" }]);
      mocks.getDebts.mockResolvedValue([]);
      mocks.getReceivables.mockResolvedValue([]);

      const { result } = renderHook(() => useCoachOverview(), { wrapper });

      await waitFor(() => expect(result.current.coach).toBeTruthy());
      expect(result.current.coach?.recommendations).toHaveLength(1);
      expect(result.current.health?.score).toBe(72);
      expect(result.current.milestones).toHaveLength(1);
      await waitFor(() => expect(result.current.hasData).toBe(true));
    });
  });

  describe("Edge Cases", () => {
    it("sollte hasData=false liefern, wenn keine Finanzdaten existieren", async () => {
      mocks.getCoachOverview.mockResolvedValue({ recommendations: [] });
      mocks.getFinancialHealth.mockResolvedValue({ score: 0 });
      mocks.evaluateMilestones.mockResolvedValue([]);
      mocks.getTransactions.mockResolvedValue([]);
      mocks.getDebts.mockResolvedValue([]);
      mocks.getReceivables.mockResolvedValue([]);

      const { result } = renderHook(() => useCoachOverview(), { wrapper });

      await waitFor(() => expect(result.current.hasData).toBe(false));
    });

    it("sollte hasData=true liefern, wenn nur Schulden existieren (keine Buchungen)", async () => {
      mocks.getCoachOverview.mockResolvedValue({ recommendations: [] });
      mocks.getFinancialHealth.mockResolvedValue({ score: 0 });
      mocks.evaluateMilestones.mockResolvedValue([]);
      mocks.getTransactions.mockResolvedValue([]);
      mocks.getDebts.mockResolvedValue([{ id: "d1" }]);
      mocks.getReceivables.mockResolvedValue([]);

      const { result } = renderHook(() => useCoachOverview(), { wrapper });

      await waitFor(() => expect(result.current.hasData).toBe(true));
    });
  });
});
