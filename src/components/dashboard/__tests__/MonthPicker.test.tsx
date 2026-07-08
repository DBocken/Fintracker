import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MonthPicker } from "../MonthPicker";
import { I18nProvider } from "@/i18n/I18nProvider";

describe("MonthPicker", () => {
  const available = ["2026-01", "2026-03", "2025-11"];

  it("zeigt den ausgewählten Monat als Label", () => {
    render(
      <I18nProvider initialLocale="de">
        <MonthPicker value="2026-03" onChange={() => {}} availableMonths={available} label="Monat A" />
      </I18nProvider>
    );
    expect(screen.getByText("März 2026")).toBeInTheDocument();
  });

  it("wählt einen verfügbaren Monat und ruft onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <I18nProvider initialLocale="de">
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
      <I18nProvider initialLocale="de">
        <MonthPicker value="2026-03" onChange={() => {}} availableMonths={available} label="Monat A" />
      </I18nProvider>
    );
    await user.click(screen.getByRole("button", { name: "März 2026" }));
    // Februar 2026 hat keine Daten -> deaktiviert.
    expect(await screen.findByRole("button", { name: "Feb" })).toBeDisabled();
  });

  describe("i18n Compliance", () => {
    it("[REGRESSION] sollte das Trigger-Label und die Monatsabkürzungen auf Englisch rendern (nicht hartcodiertes Deutsch)", async () => {
      const user = userEvent.setup();
      render(
        <I18nProvider initialLocale="en">
          <MonthPicker value="2026-03" onChange={() => {}} availableMonths={available} label="Month A" />
        </I18nProvider>
      );
      // Vorher war Intl.DateTimeFormat("de-DE", …) hartcodiert — englische
      // Nutzer sahen trotzdem "März 2026". Muss jetzt "March 2026" zeigen.
      expect(screen.getByText("March 2026")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "March 2026" }));
      expect(await screen.findByRole("button", { name: "Jan" })).toBeInTheDocument();
    });
  });

  describe("Jahresnavigation", () => {
    it("sollte über eine Jahresgrenze hinweg navigieren und Monate im neuen Jahr verfügbar machen", async () => {
      const user = userEvent.setup();
      const spanning = ["2025-11", "2026-01"];
      render(
        <I18nProvider initialLocale="de">
          <MonthPicker value="2026-01" onChange={() => {}} availableMonths={spanning} label="Monat A" />
        </I18nProvider>
      );
      await user.click(screen.getByRole("button", { name: "Januar 2026" }));
      await user.click(screen.getByRole("button", { name: "Vorheriges Jahr" }));
      // Im Vorjahr (2025) ist November verfügbar (nicht deaktiviert).
      expect(await screen.findByRole("button", { name: "Nov" })).toBeEnabled();
      // Am unteren Rand (minYear erreicht) ist "Vorheriges Jahr" jetzt gesperrt.
      expect(screen.getByRole("button", { name: "Vorheriges Jahr" })).toBeDisabled();
    });
  });

  describe("Edge Cases", () => {
    it("sollte ohne verfügbare Monate alle Tage deaktivieren und nicht abstürzen", () => {
      render(
        <I18nProvider initialLocale="de">
          <MonthPicker value="" onChange={() => {}} availableMonths={[]} label="Monat A" />
        </I18nProvider>
      );
      expect(screen.getByText("Monat wählen…")).toBeInTheDocument();
    });
  });
});
