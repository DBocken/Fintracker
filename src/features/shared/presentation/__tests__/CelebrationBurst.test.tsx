import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import CelebrationBurst from "../CelebrationBurst";

const reduceMock = vi.fn(() => false);
vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => reduceMock(),
}));

afterEach(() => reduceMock.mockReturnValue(false));

describe("CelebrationBurst", () => {
  it("sollte ein SVG mit der gewünschten Strahlenzahl rendern", () => {
    const { container } = render(<CelebrationBurst rays={8} />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.querySelectorAll("line").length).toBe(8);
  });

  it("sollte standardmäßig animiert sein (data-animated=true + animation-Style)", () => {
    const { container } = render(<CelebrationBurst />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("data-animated")).toBe("true");
    const g = svg.querySelector("g")!;
    expect(g.getAttribute("style")).toContain("celebration-burst");
  });

  describe("Reduced Motion", () => {
    it("sollte ohne Animations-Style rendern, wenn reduzierte Bewegung aktiv ist", () => {
      reduceMock.mockReturnValue(true);
      const { container } = render(<CelebrationBurst />);
      const svg = container.querySelector("svg")!;
      expect(svg.getAttribute("data-animated")).toBe("false");
      expect(svg.querySelector("g")!.getAttribute("style")).toBeFalsy();
    });
  });
});
