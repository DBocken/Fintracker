import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor, within } from "@testing-library/react";
import HealthScoreCard from "../HealthScoreCard";
import type { FinancialHealth } from "@/services/financial-health-service";

// Reduced-Motion pro Test steuerbar (greift in useAnimatedNumber).
const reduceMock = vi.fn(() => false);
vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => reduceMock(),
}));

afterEach(() => reduceMock.mockReturnValue(false));

function makeHealth(score: number): FinancialHealth {
  return {
    score,
    subScores: [
      { key: "emergency_fund", label: "Notgroschen", score, explanation: "Test" },
    ],
    netWorth: { cash: 0, investments: 0, realEstate: 0, other: 0, liabilities: 0, total: 0 } as never,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    savingsRate: 0,
  };
}

describe("HealthScoreCard", () => {
  describe("Normal Behavior", () => {
    it("sollte den Ziel-Score datengetrieben als data-Attribut tragen", () => {
      const { container } = render(<HealthScoreCard health={makeHealth(72)} />);
      const root = container.querySelector("[data-health-score]");
      expect(root?.getAttribute("data-health-score")).toBe("72");
    });

    it("sollte den Score über den Tween bis zum Zielwert hochzählen", async () => {
      const { container } = render(<HealthScoreCard health={makeHealth(72)} />);
      const ring = container.querySelector(".relative.h-20") as HTMLElement;
      await waitFor(() => expect(within(ring).getByText("72")).toBeInTheDocument(), {
        timeout: 3000,
      });
    });

    it("sollte einen farbigen Fortschritts-Ring rendern", () => {
      const { container } = render(<HealthScoreCard health={makeHealth(50)} />);
      const circles = container.querySelectorAll("circle");
      // Hintergrund-Ring + Fortschritts-Ring.
      expect(circles.length).toBe(2);
      expect(circles[1].getAttribute("stroke")).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("sollte einen Score von 0 verarbeiten", () => {
      const { container } = render(<HealthScoreCard health={makeHealth(0)} />);
      expect(container.querySelector("[data-health-score]")?.getAttribute("data-health-score")).toBe("0");
    });
  });

  describe("Reduced Motion", () => {
    it("sollte bei prefers-reduced-motion den Score sofort und ohne Tween zeigen", () => {
      reduceMock.mockReturnValue(true);
      const { container } = render(<HealthScoreCard health={makeHealth(64)} />);
      const ring = container.querySelector(".relative.h-20") as HTMLElement;
      expect(within(ring).getByText("64")).toBeInTheDocument();
    });
  });
});
