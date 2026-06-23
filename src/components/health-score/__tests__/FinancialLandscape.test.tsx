import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/i18n/I18nProvider";
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

function renderLandscape(variant: "hero" | "hero-compact" | "strip") {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <FinancialLandscape health={health} variant={variant} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("FinancialLandscape mobile illustration", () => {
  it("rendert die Illustration mit antippbaren Hotspots (hero-compact)", () => {
    renderLandscape("hero-compact");
    // Alle fünf Metriken als antippbare Hotspots
    const hotspots = screen.getAllByRole("button");
    expect(hotspots.length).toBeGreaterThanOrEqual(5);
    // Hintergrund-Illustration vorhanden.
    expect(screen.getByAltText("Finanzlandschaft")).toBeInTheDocument();
  });

  it("öffnet ein Sheet mit Erklärung beim Antippen eines Hotspots", async () => {
    const user = userEvent.setup();
    renderLandscape("hero-compact");
    const buttons = screen.getAllByRole("button");
    // Click first button (should be emergency_fund based on render order)
    await user.click(buttons[0]);
    expect(await screen.findByText(/Erklärung/)).toBeInTheDocument();
  });
});
