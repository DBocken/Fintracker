import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor, within } from "@testing-library/react";
import { I18nProvider } from "@/i18n/I18nProvider";
import { translations } from "@/i18n/translations";
import HealthScoreCard from "../HealthScoreCard";
import type { FinancialHealth } from "@/services/financial-health-service";

// Reduced-Motion pro Test steuerbar (greift in useAnimatedNumber).
const reduceMock = vi.fn(() => false);
vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => reduceMock(),
}));

afterEach(() => reduceMock.mockReturnValue(false));

function renderWithI18n(component: any, locale: "de" | "en" = "de") {
  return render(
    <I18nProvider initialLocale={locale}>
      {component}
    </I18nProvider>
  );
}

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
      const { container } = renderWithI18n(<HealthScoreCard health={makeHealth(72)} />, "de");
      const root = container.querySelector("[data-health-score]");
      expect(root?.getAttribute("data-health-score")).toBe("72");
    });

    it("sollte den Score über den Tween bis zum Zielwert hochzählen", async () => {
      const { container } = renderWithI18n(<HealthScoreCard health={makeHealth(72)} />, "de");
      const ring = container.querySelector(".relative.h-20") as HTMLElement;
      await waitFor(() => expect(within(ring).getByText("72")).toBeInTheDocument(), {
        timeout: 3000,
      });
    });

    it("sollte einen farbigen Fortschritts-Ring rendern", () => {
      const { container } = renderWithI18n(<HealthScoreCard health={makeHealth(50)} />, "de");
      const circles = container.querySelectorAll("circle");
      // Hintergrund-Ring + Fortschritts-Ring.
      expect(circles.length).toBe(2);
      expect(circles[1].getAttribute("stroke")).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("sollte einen Score von 0 verarbeiten", () => {
      const { container } = renderWithI18n(<HealthScoreCard health={makeHealth(0)} />, "de");
      expect(container.querySelector("[data-health-score]")?.getAttribute("data-health-score")).toBe("0");
    });
  });

  describe("Reduced Motion", () => {
    it("sollte bei prefers-reduced-motion den Score sofort und ohne Tween zeigen", () => {
      reduceMock.mockReturnValue(true);
      const { container } = renderWithI18n(<HealthScoreCard health={makeHealth(64)} />, "de");
      const ring = container.querySelector(".relative.h-20") as HTMLElement;
      expect(within(ring).getByText("64")).toBeInTheDocument();
    });
  });

  describe("Internationalization", () => {
    it("sollte deutsche Texte rendern", () => {
      renderWithI18n(<HealthScoreCard health={makeHealth(72)} />, "de");
      expect(translations.de.health.financialHealthScore).toBeDefined();
      expect(translations.de.health.subscores).toBeDefined();
    });

    it("should render English texts", () => {
      renderWithI18n(<HealthScoreCard health={makeHealth(72)} />, "en");
      expect(translations.en.health.financialHealthScore).toBeDefined();
      expect(translations.en.health.subscores).toBeDefined();
    });

    it("[REGRESSION] should have all health score i18n keys in both languages", () => {
      const requiredKeys = ["health.financialHealthScore", "health.subscores"];

      requiredKeys.forEach((key) => {
        const path = key.split(".");
        let deValue: any = translations.de;
        let enValue: any = translations.en;

        path.forEach((p) => {
          const deHas = deValue && typeof deValue === "object" && p in deValue;
          const enHas = enValue && typeof enValue === "object" && p in enValue;
          expect(deHas).toBe(true);
          expect(enHas).toBe(true);
          deValue = deValue[p];
          enValue = enValue[p];
        });

        expect(typeof deValue).toBe("string");
        expect(typeof enValue).toBe("string");
      });
    });
  });
});
