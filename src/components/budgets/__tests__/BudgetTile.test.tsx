import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Budget, BudgetStatus } from "@/types";
import { I18nProvider } from "@/i18n/I18nProvider";
import BudgetTile from "../BudgetTile";

// Helper: I18nProvider Wrapper
function renderWithI18n(
  component: React.ReactElement,
  locale: "de" | "en" = "de"
) {
  return render(
    <I18nProvider initialLocale={locale}>
      {component}
    </I18nProvider>
  );
}

const status = (over: Partial<BudgetStatus> = {}): BudgetStatus => ({
  budget: { id: "b1", name: "Lebensmittel", category_id: "c1", limit: 250, icon: "🛒" } as Budget,
  spent: 239,
  remaining: 11,
  ratio: 0.956,
  fillPercent: 95.6,
  health: "warn",
  ...over,
});

describe("BudgetTile", () => {
  it("sollte Symbol + Tank zeigen und den Namen nur als a11y-Label tragen", () => {
    renderWithI18n(<BudgetTile status={status()} onClick={() => {}} />);
    // Kompakt: Name ist NICHT als sichtbarer Text gerendert, aber im aria-label.
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-label")).toContain("Lebensmittel");
    expect(btn.querySelector("svg")).toBeTruthy();
  });

  it("sollte beim Klick onClick auslösen", async () => {
    const onClick = vi.fn();
    renderWithI18n(<BudgetTile status={status()} onClick={onClick} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
