import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MonthPicker } from "../MonthPicker";
import { I18nProvider } from "@/i18n/I18nProvider";

describe("MonthPicker", () => {
  const available = ["2026-01", "2026-03", "2025-11"];

  it("zeigt den ausgewählten Monat als Label", () => {
    render(
      <I18nProvider>
        <MonthPicker value="2026-03" onChange={() => {}} availableMonths={available} label="Monat A" />
      </I18nProvider>
    );
    expect(screen.getByText("März 2026")).toBeInTheDocument();
  });

  it("wählt einen verfügbaren Monat und ruft onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <I18nProvider>
        <MonthPicker value="2026-03" onChange={onChange} availableMonths={available} label="Monat A" />
      </I18nProvider>
    );

    await user.click(screen.getByRole("button", { name: "März 2026" }));
    // Monatsraster ist offen: Januar (verfügbar) anklicken.
    await user.click(await screen.findByRole("button", { name: "Jan" }));
    expect(onChange).toHaveBeenCalledWith("2026-01");
  });

  it("deaktiviert Monate ohne Daten", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <MonthPicker value="2026-03" onChange={() => {}} availableMonths={available} label="Monat A" />
      </I18nProvider>
    );
    await user.click(screen.getByRole("button", { name: "März 2026" }));
    // Februar 2026 hat keine Daten -> deaktiviert.
    expect(await screen.findByRole("button", { name: "Feb" })).toBeDisabled();
  });
});
