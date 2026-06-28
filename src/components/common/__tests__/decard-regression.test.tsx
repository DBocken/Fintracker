import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatHero from "../StatHero";
import { KpiCard } from "@/components/kpi/KpiCard";

/** Karten-Chrome = sichtbarer Rahmen (`border`-Breiten-Utility) oder Schatten.
 * Hintergrund-Tönung/Verlauf zum Bündeln zählt NICHT als Karte. */
function hasCardChrome(el: HTMLElement): boolean {
  const tokens = el.className.split(/\s+/);
  const hasBorderUtil = tokens.some((c) => /^border(-(x|y|t|r|b|l|s|e))?$/.test(c));
  const hasShadow = tokens.some((c) => /^shadow(-|$)/.test(c));
  return hasBorderUtil || hasShadow;
}

describe("De-Carding: reine Anzeige ohne Karten-Chrome (Usability-Audit)", () => {
  describe("StatHero", () => {
    it("sollte Label, Wert und Inhalt weiterhin anzeigen", () => {
      render(<StatHero label="Aktueller Kontostand" value="2.310 €" caption="Saldo im Zeitraum" />);
      expect(screen.getByText("Aktueller Kontostand")).toBeInTheDocument();
      expect(screen.getByText("2.310 €")).toBeInTheDocument();
    });

    it("[REGRESSION] sollte als Hero OHNE Rahmen/Schatten rendern und nicht klickbar wirken", () => {
      const { container } = render(<StatHero label="Saldo" value="100 €" />);
      expect(hasCardChrome(container.firstElementChild as HTMLElement)).toBe(false);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
  });

  describe("KpiCard", () => {
    it("sollte Label, Wert und Hinweis anzeigen", () => {
      render(<KpiCard label="Netto-Cashflow" value="2.310 €" hint="im Zeitraum" />);
      expect(screen.getByText("Netto-Cashflow")).toBeInTheDocument();
      expect(screen.getByText("2.310 €")).toBeInTheDocument();
      expect(screen.getByText("im Zeitraum")).toBeInTheDocument();
    });

    it("[REGRESSION] sollte ohne Karten-Chrome und ohne verschachteltes Icon-Kästchen rendern", () => {
      // Doppelte Rahmen (Karte + Icon-Kästchen) haben Nutzer fälschlich für
      // klickbar gehalten – jetzt ein ruhiges Readout ohne Rahmen/Schatten.
      const { container } = render(<KpiCard label="A" value="1" />);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(hasCardChrome(container.firstElementChild as HTMLElement)).toBe(false);
    });
  });
});
