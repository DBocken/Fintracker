import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import BudgetTank from "../BudgetTank";

// Der Tank ist ein reines SVG (kein Canvas/Lottie), daher in jsdom direkt
// renderbar. Wir prüfen die datengetriebene Füllung über das data-fill-Attribut
// und das Kappen außerhalb 0..100.
function fillOf(container: HTMLElement): number {
  return Number(container.querySelector("svg")?.getAttribute("data-fill"));
}

describe("BudgetTank", () => {
  it("sollte ein SVG mit dem Füllstand als data-fill rendern", () => {
    const { container } = render(<BudgetTank fillPercent={42} health="ok" />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(fillOf(container)).toBe(42);
  });

  it("sollte Füllstände über 100 kappen", () => {
    const { container } = render(<BudgetTank fillPercent={250} health="over" />);
    expect(fillOf(container)).toBe(100);
  });

  it("sollte NaN/negative Füllstände auf 0 setzen und keine Flüssigkeit zeichnen", () => {
    const nan = render(<BudgetTank fillPercent={Number.NaN} health="warn" />);
    expect(fillOf(nan.container)).toBe(0);
    const neg = render(<BudgetTank fillPercent={-20} health="ok" />);
    expect(fillOf(neg.container)).toBe(0);
  });

  it("sollte eindeutige Gradient-IDs je Instanz vergeben (keine Kollision)", () => {
    const { container } = render(
      <div>
        <BudgetTank fillPercent={30} health="ok" />
        <BudgetTank fillPercent={60} health="warn" />
      </div>,
    );
    const grads = container.querySelectorAll("linearGradient[id^='tank-grad-']");
    const ids = new Set(Array.from(grads).map((g) => g.id));
    expect(ids.size).toBe(grads.length);
  });
});
