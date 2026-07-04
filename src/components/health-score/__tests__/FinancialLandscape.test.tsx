import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/i18n/I18nProvider";
import { translations } from "@/i18n/translations";
import FinancialLandscape from "../FinancialLandscape";
import type { FinancialHealth } from "@/services/financial-health-service";

const health: FinancialHealth = {
  score: 60,
  subScores: [
    { key: "emergency_fund", label: "Notgroschen", score: 40, explanation: "Notgroschen-Erklärung" },
    { key: "debt", label: "Schulden", score: 70, explanation: "Schulden-Erklärung" },
    { key: "savings_rate", label: "Sparquote", score: 55, explanation: "Sparquote-Erklärung" },
    { key: "liquidity", label: "Liquidität", score: 80, explanation: "Liquiditäts-Erklärung" },
    { key: "contracts", label: "Verträge", score: 65, explanation: "Vertrags-Erklärung" },
  ],
  netWorth: {} as FinancialHealth["netWorth"],
  monthlyIncome: 0,
  monthlyExpenses: 0,
  savingsRate: 0,
};

function renderLandscape(
  component: any,
  locale: "de" | "en" = "de"
) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider initialLocale={locale}>
        {component}
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("FinancialLandscape mobile illustration", () => {
  it("rendert die Illustration mit antippbaren Hotspots (hero-compact)", () => {
    renderLandscape(<FinancialLandscape health={health} variant="hero-compact" />, "de");
    // Alle fünf Metriken als antippbare Hotspots
    const hotspots = screen.getAllByRole("button");
    expect(hotspots.length).toBeGreaterThanOrEqual(5);
    // Hintergrund-Illustration vorhanden.
    expect(screen.getByAltText(translations.de.financialLandscape.backgroundAlt)).toBeInTheDocument();
  });

  it("öffnet ein Sheet mit Erklärung beim Antippen eines Hotspots", async () => {
    const user = userEvent.setup();
    renderLandscape(<FinancialLandscape health={health} variant="hero-compact" />, "de");
    const buttons = screen.getAllByRole("button");
    // Click first button (should be emergency_fund based on render order)
    await user.click(buttons[0]);
    expect(await screen.findByText(/Erklärung/)).toBeInTheDocument();
  });

  it("should render illustration with English alt text", () => {
    renderLandscape(<FinancialLandscape health={health} variant="hero-compact" />, "en");
    expect(screen.getByAltText(translations.en.financialLandscape.backgroundAlt)).toBeInTheDocument();
  });

  it("[REGRESSION] should have all financial landscape i18n keys in both languages", () => {
    const requiredKeys = [
      "financialLandscape.backgroundAlt",
      "health.emergencyFund",
      "health.debt",
      "health.savingsRate",
      "health.liquidity",
      "health.contracts",
    ];

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
