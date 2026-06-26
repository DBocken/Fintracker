import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

// lottie-web baut beim Import einen Canvas-Kontext auf, den jsdom nicht liefert.
// Wir mocken den Light-Player und prüfen damit die Verdrahtung der Komponente
// (loadAnimation + goToAndStop auf den Füllstand-Frame) ohne echten Renderer.
const { goToAndStop, destroy, loadAnimation } = vi.hoisted(() => {
  const goToAndStop = vi.fn();
  const destroy = vi.fn();
  const addEventListener = vi.fn();
  const loadAnimation = vi.fn(() => ({ goToAndStop, destroy, addEventListener }));
  return { goToAndStop, destroy, loadAnimation };
});

vi.mock("lottie-web/build/player/lottie_light", () => ({
  default: { loadAnimation },
}));

import BudgetTank from "../BudgetTank";

describe("BudgetTank", () => {
  beforeEach(() => {
    goToAndStop.mockClear();
    destroy.mockClear();
    loadAnimation.mockClear();
  });

  it("sollte rendern und auf den Füllstand-Frame springen", () => {
    const { container } = render(<BudgetTank fillPercent={42} health="ok" />);
    expect(container.firstChild).toBeTruthy();
    expect(loadAnimation).toHaveBeenCalledTimes(1);
    expect(goToAndStop).toHaveBeenCalledWith(42, true);
  });

  it("sollte Füllstände außerhalb 0..100 kappen", () => {
    render(<BudgetTank fillPercent={250} health="over" />);
    expect(goToAndStop).toHaveBeenCalledWith(100, true);
  });

  it("sollte NaN-Füllstand robust auf 0 setzen", () => {
    render(<BudgetTank fillPercent={Number.NaN} health="warn" />);
    expect(goToAndStop).toHaveBeenCalledWith(0, true);
  });

  it("sollte beim Unmount aufräumen", () => {
    const { unmount } = render(<BudgetTank fillPercent={10} health="ok" />);
    unmount();
    expect(destroy).toHaveBeenCalled();
  });
});
