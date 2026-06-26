import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import AnimatedCheck from "../AnimatedCheck";

const reduceMock = vi.fn(() => false);
vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => reduceMock(),
}));

afterEach(() => reduceMock.mockReturnValue(false));

describe("AnimatedCheck", () => {
  it("sollte einen Haken-Pfad rendern und ihn standardmäßig zeichnen (Draw-on)", () => {
    const { container } = render(<AnimatedCheck />);
    const path = container.querySelector("path")!;
    expect(path).toBeTruthy();
    expect(path.getAttribute("style")).toContain("check-draw");
    expect(container.querySelector("svg")!.getAttribute("data-animated")).toBe("true");
  });

  describe("Reduced Motion", () => {
    it("sollte den Haken ohne Draw-on-Animation fertig gezeichnet zeigen", () => {
      reduceMock.mockReturnValue(true);
      const { container } = render(<AnimatedCheck />);
      const path = container.querySelector("path")!;
      expect(path.getAttribute("style")).toBeFalsy();
      expect(container.querySelector("svg")!.getAttribute("data-animated")).toBe("false");
    });
  });
});
