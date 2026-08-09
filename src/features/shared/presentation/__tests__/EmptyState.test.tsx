import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import EmptyState from "../EmptyState";

const reduceMock = vi.fn(() => false);
vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => reduceMock(),
}));

afterEach(() => reduceMock.mockReturnValue(false));

describe("EmptyState", () => {
  describe("Backward Compatibility", () => {
    it("sollte ohne animated-Flag das Emoji statisch rendern (kein Animations-Style)", () => {
      render(<EmptyState emoji="📭" title="Keine Daten" />);
      const el = screen.getByText("📭");
      expect(el.getAttribute("data-animated")).toBe("false");
      expect(el.getAttribute("style")).toBeFalsy();
    });

    it("sollte Titel, Beschreibung und Action rendern", () => {
      render(
        <EmptyState
          emoji="📭"
          title="Keine Buchungen"
          description="Importiere eine CSV"
          action={<button>Import</button>}
        />,
      );
      expect(screen.getByText("Keine Buchungen")).toBeInTheDocument();
      expect(screen.getByText("Importiere eine CSV")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();
    });
  });

  describe("Animated opt-in", () => {
    it("sollte das Emoji mit Schweb-Animation versehen, wenn animated gesetzt ist", () => {
      render(<EmptyState emoji="📭" title="Keine Daten" animated />);
      const el = screen.getByText("📭");
      expect(el.getAttribute("data-animated")).toBe("true");
      expect(el.getAttribute("style")).toContain("float-breathe");
    });

    it("sollte bei prefers-reduced-motion trotz animated still bleiben", () => {
      reduceMock.mockReturnValue(true);
      render(<EmptyState emoji="📭" title="Keine Daten" animated />);
      const el = screen.getByText("📭");
      expect(el.getAttribute("data-animated")).toBe("false");
      expect(el.getAttribute("style")).toBeFalsy();
    });
  });
});
