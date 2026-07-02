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

function renderLandscape(
  variant: "hero" | "hero-compact" | "strip",
  // Kein Default-Parameter: explizites `undefined` muss "keine Daten" bleiben.
  ...rest: [] | [FinancialHealth | undefined]
) {
  const healthOverride = rest.length > 0 ? rest[0] : health;
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <FinancialLandscape health={healthOverride} variant={variant} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("FinancialLandscape (generative Illustration)", () => {
  describe("Normal Behavior", () => {
    it("rendert die Illustration mit antippbaren Hotspots (hero-compact)", () => {
      renderLandscape("hero-compact");
      // Alle fünf Metriken als antippbare Hotspots
      const hotspots = screen.getAllByRole("button");
      expect(hotspots.length).toBeGreaterThanOrEqual(5);
      // Generative SVG-Szene statt Bild-Asset.
      expect(screen.getByRole("img", { name: /Finanzlandschaft|Financial landscape/ })).toBeInTheDocument();
    });

    it("zeichnet für jede Metrik ihr Landschaftselement", () => {
      renderLandscape("hero");
      expect(screen.getByTestId("landscape-sun")).toBeInTheDocument();
      expect(screen.getByTestId("landscape-mountain")).toBeInTheDocument();
      expect(screen.getByTestId("landscape-tree")).toBeInTheDocument();
      expect(screen.getByTestId("landscape-water")).toBeInTheDocument();
      expect(screen.getByTestId("landscape-house")).toBeInTheDocument();
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

  describe("Edge Cases", () => {
    it("rendert ohne health-Daten die leere Szene ohne Hotspots", () => {
      renderLandscape("hero", undefined);
      expect(screen.getByRole("img", { name: /Finanzlandschaft|Financial landscape/ })).toBeInTheDocument();
      expect(screen.queryAllByRole("button")).toHaveLength(0);
      expect(screen.queryByTestId("landscape-tree")).not.toBeInTheDocument();
    });
  });

  describe("Regression Protection", () => {
    it("[REGRESSION] lädt keine PNG-Assets mehr (kein Broken-Image bei fehlenden Dateien)", () => {
      // Vorher: background.png + 5 Stufen-PNGs pro Metrik; fehlende Dateien
      // erzeugten Broken Images mit Emoji-Fallback. Die Szene ist jetzt reines SVG.
      const { container } = renderLandscape("hero");
      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector("svg[data-testid='dynamic-landscape']")).not.toBeNull();
    });

    it("[REGRESSION] Wasserstand folgt dem Liquiditäts-Score (datengetriebener Aufbau)", () => {
      const low: FinancialHealth = {
        ...health,
        subScores: [{ key: "liquidity", label: "Liquidität", score: 10, explanation: "x" }],
      };
      const highScore: FinancialHealth = {
        ...health,
        subScores: [{ key: "liquidity", label: "Liquidität", score: 90, explanation: "x" }],
      };
      const a = renderLandscape("hero", low);
      const lowLevel = Number(screen.getByTestId("landscape-water").getAttribute("data-level"));
      a.unmount();
      renderLandscape("hero", highScore);
      const highLevel = Number(screen.getByTestId("landscape-water").getAttribute("data-level"));
      expect(highLevel).toBeGreaterThan(lowLevel);
    });
  });
});
