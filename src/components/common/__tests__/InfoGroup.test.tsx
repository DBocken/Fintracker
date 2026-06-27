import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InfoGroup, InfoStatStrip } from "../InfoGroup";

/** Karten-Chrome = sichtbarer Rahmen (`border`-Breiten-Utility) oder Schatten.
 * `divide-border` (Trennlinien-Farbe) zählt bewusst NICHT als Karte. */
function hasCardChrome(el: HTMLElement): boolean {
  const tokens = el.className.split(/\s+/);
  const hasBorderUtil = tokens.some((c) => /^border(-(x|y|t|r|b|l|s|e))?$/.test(c));
  const hasShadow = tokens.some((c) => /^shadow(-|$)/.test(c));
  return hasBorderUtil || hasShadow;
}

describe("InfoGroup", () => {
  describe("Normal Behavior", () => {
    it("sollte Titel, Beschreibung und Inhalt anzeigen", () => {
      render(
        <InfoGroup title="Schuldenkontext" description="Überblick">
          <div>Inhalt</div>
        </InfoGroup>,
      );
      expect(screen.getByText("Schuldenkontext")).toBeInTheDocument();
      expect(screen.getByText("Überblick")).toBeInTheDocument();
      expect(screen.getByText("Inhalt")).toBeInTheDocument();
    });
  });

  describe("Regression Protection", () => {
    it("[REGRESSION] sollte reine Anzeige sein – KEINE klickbare Karte (kein button/link, keine Karten-Chrome)", () => {
      // Kern der Regel: Info ohne Follow-up darf NICHT wie eine Karte wirken.
      const { container } = render(
        <InfoGroup title="Nur Info">
          <div>Wert</div>
        </InfoGroup>,
      );
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(hasCardChrome(container.firstElementChild as HTMLElement)).toBe(false);
    });
  });
});

describe("InfoStatStrip", () => {
  describe("Normal Behavior", () => {
    it("sollte alle Stats mit Label, Wert und Hinweis als dl/dt/dd rendern", () => {
      render(
        <InfoStatStrip
          items={[
            { label: "Gesamtschuld", value: "3.420 €" },
            { label: "Mindestraten / Monat", value: "180 €", hint: "monatlich" },
            { label: "Offene Schulden", value: 3 },
          ]}
        />,
      );
      expect(screen.getByText("Gesamtschuld")).toBeInTheDocument();
      expect(screen.getByText("3.420 €")).toBeInTheDocument();
      expect(screen.getByText("monatlich")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  describe("Regression Protection", () => {
    it("[REGRESSION] sollte ein Readout ohne Karten-Kacheln und ohne Klick-Affordanz sein", () => {
      const { container } = render(
        <InfoStatStrip items={[{ label: "A", value: "1" }]} />,
      );
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      // Kein Rahmen/Schatten → liest sich nicht als antippbare Kachel.
      expect(hasCardChrome(container.firstElementChild as HTMLElement)).toBe(false);
    });
  });
});
