import { screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test-utils/render";
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
      renderWithI18n(
        <AdaptiveSpendingToggle
          enabled={false}
          onEnabledChange={() => {}}
          strength={0.5}
          onStrengthChange={() => {}}
        />,
        "de"
      );
      expect(
        screen.getByText(/Was, wenn du von Anfang an gegensteuerst/),
      ).toBeInTheDocument();
      expect(screen.getByRole("switch", { name: /Bei Knappheit gegensteuern/ })).toBeInTheDocument();
    });

    it("sollte beim Umschalten onEnabledChange aufrufen", () => {
      const onEnabledChange = vi.fn();
      renderWithI18n(
        <AdaptiveSpendingToggle
          enabled={false}
          onEnabledChange={onEnabledChange}
          strength={0.5}
          onStrengthChange={() => {}}
        />,
        "de"
      );
      fireEvent.click(screen.getByRole("switch", { name: /Bei Knappheit gegensteuern/ }));
      expect(onEnabledChange).toHaveBeenCalledWith(true);
    });
  });

  describe("i18n Compliance", () => {
    it("sollte Titel, Schalter und Regler auf Englisch anzeigen", () => {
      renderWithI18n(
        <AdaptiveSpendingToggle
          enabled={true}
          onEnabledChange={() => {}}
          strength={0.7}
          onStrengthChange={() => {}}
        />,
        "en"
      );
      expect(screen.getByText(/What if you counter-steer from the start\?/)).toBeInTheDocument();
      expect(screen.getByRole("switch", { name: /Counter-steer when tight/ })).toBeInTheDocument();
      expect(screen.getByLabelText(/Consistency of counter-steering/)).toBeInTheDocument();
    });
  });

  describe("Konsequenz-Regler (nur wenn aktiv)", () => {
    it("sollte den Regler NICHT zeigen, solange deaktiviert", () => {
      renderWithI18n(
        <AdaptiveSpendingToggle
          enabled={false}
          onEnabledChange={() => {}}
          strength={0.5}
          onStrengthChange={() => {}}
        />,
        "de"
      );
      expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    });

    it("sollte bei Aktivierung Regler (mit Wert) und Prozentanzeige zeigen", () => {
      renderWithI18n(
        <AdaptiveSpendingToggle
          enabled={true}
          onEnabledChange={() => {}}
          strength={0.7}
          onStrengthChange={() => {}}
        />,
        "de"
      );
      // Der aria-label sitzt auf der Slider-Wurzel; role="slider" trägt der Thumb.
      expect(screen.getByLabelText(/Konsequenz des Gegensteuerns/)).toBeInTheDocument();
      expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "70");
      expect(screen.getByText("70 %")).toBeInTheDocument();
    });
  });
});
