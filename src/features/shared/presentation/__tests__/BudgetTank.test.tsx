import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import BudgetTank from "../BudgetTank";

const reduceMock = vi.fn(() => false);
vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => reduceMock(),
}));

afterEach(() => reduceMock.mockReturnValue(false));

// Der Tank ist ein reines SVG (kein Canvas/Lottie), daher in jsdom direkt
// renderbar. Wir prüfen die datengetriebene Füllung über das data-fill-Attribut
// und das Kappen außerhalb 0..100.
function fillOf(container: HTMLElement): number {
  return Number(container.querySelector("svg")?.getAttribute("data-fill"));
}

/**
 * Ob der Tank in die `motion.div` für die Shared-Element-Transition gewrappt ist.
 *
 * Geprüft wird die Struktur, nicht ein Attribut: framer-motion setzt KEIN
 * `data-framer-name` (das stammt aus dem Framer-Design-Tool, nicht aus der
 * Bibliothek). Die Vorgängerfassung suchte danach — der Positiv-Test konnte
 * deshalb nie bestehen, und die beiden Negativ-Tests bestanden immer, ganz
 * gleich was gerendert wurde. Beobachtbar ist: mit Wrapper ist die Wurzel ein
 * `div` um das SVG, ohne Wrapper ist das SVG selbst die Wurzel.
 */
function hasMotionWrapper(container: HTMLElement): boolean {
  const root = container.firstElementChild;
  return root?.tagName.toLowerCase() === "div" && root.querySelector("svg") !== null;
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

  it("sollte mit layoutId einen Framer-Motion-Wrapper rendern (WP-4.4)", () => {
    const { container } = render(
      <BudgetTank fillPercent={50} health="ok" layoutId="budget-tank-1" />,
    );
    expect(hasMotionWrapper(container)).toBe(true);
  });

  it("sollte ohne layoutId keinen Framer-Motion-Wrapper rendern (WP-4.4)", () => {
    const { container } = render(
      <BudgetTank fillPercent={50} health="ok" />,
    );
    expect(hasMotionWrapper(container)).toBe(false);
    expect(container.firstElementChild?.tagName.toLowerCase()).toBe("svg");
  });

  it("sollte bei reduced-motion keinen layoutId-Wrapper rendern (WP-4.4)", () => {
    reduceMock.mockReturnValue(true);
    const { container } = render(
      <BudgetTank fillPercent={50} health="ok" layoutId="budget-tank-1" />,
    );
    expect(hasMotionWrapper(container)).toBe(false);
    expect(container.querySelector("svg")).toBeTruthy();
  });

describe("Mikroreaktionen (WP-4.2)", () => {
    it("sollte bei Initial-Mount mit health=over keinen Shake auslösen", () => {
      const { container } = render(<BudgetTank fillPercent={110} health="over" animate={false} />);
      const svg = container.querySelector("svg");
      // Kein data-shake Attribut bei Initial-Mount
      expect(svg?.getAttribute("data-shake")).toBeFalsy();
    });

    it("sollte bei Wechsel warn→over data-shake aktivieren", () => {
      const { container, rerender } = render(<BudgetTank fillPercent={70} health="warn" animate={false} />);
      rerender(<BudgetTank fillPercent={110} health="over" animate={false} />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("data-shake")).toBe("true");
    });

    it("sollte Shake bei Re-Render ohne Health-Wechsel nicht wiederholen", () => {
      const { container, rerender } = render(<BudgetTank fillPercent={110} health="over" animate={false} />);
      // Re-Render mit gleichen health=over → kein neuer Shake
      rerender(<BudgetTank fillPercent={115} health="over" animate={false} />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("data-shake")).toBeFalsy();
    });

    it("sollte bei Wechsel over→ok data-breathe aktivieren", () => {
      const { container, rerender } = render(<BudgetTank fillPercent={110} health="over" animate={false} />);
      rerender(<BudgetTank fillPercent={60} health="ok" animate={false} />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("data-breathe")).toBe("true");
    });

    it("sollte bei Wechsel warn→ok data-breathe nicht aktivieren (nur von over)", () => {
      const { container, rerender } = render(<BudgetTank fillPercent={70} health="warn" animate={false} />);
      rerender(<BudgetTank fillPercent={60} health="ok" animate={false} />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("data-breathe")).toBeFalsy();
    });
  });
});
