import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdaptiveSpendingToggle from "../AdaptiveSpendingToggle";

// Radix' Slider misst seine Breite über ResizeObserver, den jsdom nicht kennt.
globalThis.ResizeObserver ||= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

describe("AdaptiveSpendingToggle", () => {
  describe("Normal Behavior", () => {
    it("sollte Titel und Schalter anzeigen", () => {
      render(
        <AdaptiveSpendingToggle
          enabled={false}
          onEnabledChange={() => {}}
          strength={0.5}
          onStrengthChange={() => {}}
        />,
      );
      expect(
        screen.getByText("Was, wenn du von Anfang an gegensteuerst?"),
      ).toBeInTheDocument();
      expect(screen.getByRole("switch", { name: "Bei Knappheit gegensteuern" })).toBeInTheDocument();
    });

    it("sollte beim Umschalten onEnabledChange aufrufen", () => {
      const onEnabledChange = vi.fn();
      render(
        <AdaptiveSpendingToggle
          enabled={false}
          onEnabledChange={onEnabledChange}
          strength={0.5}
          onStrengthChange={() => {}}
        />,
      );
      fireEvent.click(screen.getByRole("switch", { name: "Bei Knappheit gegensteuern" }));
      expect(onEnabledChange).toHaveBeenCalledWith(true);
    });
  });

  describe("Konsequenz-Regler (nur wenn aktiv)", () => {
    it("sollte den Regler NICHT zeigen, solange deaktiviert", () => {
      render(
        <AdaptiveSpendingToggle
          enabled={false}
          onEnabledChange={() => {}}
          strength={0.5}
          onStrengthChange={() => {}}
        />,
      );
      expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    });

    it("sollte bei Aktivierung Regler (mit Wert) und Prozentanzeige zeigen", () => {
      render(
        <AdaptiveSpendingToggle
          enabled={true}
          onEnabledChange={() => {}}
          strength={0.7}
          onStrengthChange={() => {}}
        />,
      );
      // Der aria-label sitzt auf der Slider-Wurzel; role="slider" trägt der Thumb.
      expect(screen.getByLabelText("Konsequenz des Gegensteuerns")).toBeInTheDocument();
      expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "70");
      expect(screen.getByText("70 %")).toBeInTheDocument();
    });
  });
});
