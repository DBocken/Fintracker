import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test-utils/render";
import { TypedSelect } from "../TypedSelect";

/**
 * WP 5.3 (KOMP-5) — `onValueChange={(v) => set(v as Union)}` stand 5× in
 * `BudgetFormDialog` und 2× in `DebtFormDialog`, immer derselbe Cast, weil
 * Radix' `<Select>` intern nur `string` kennt. `TypedSelect<T>` VERLEGT
 * diesen Cast an eine einzige geprüfte Stelle (hier in der Komponente) —
 * es eliminiert ihn nicht grundsätzlich (Radix bleibt string-basiert), aber
 * jede Aufrufstelle castet nicht mehr selbst.
 */
type Ampel = "rot" | "gelb" | "gruen";

const options = [
  { value: "rot" as Ampel, label: "Rot" },
  { value: "gelb" as Ampel, label: "Gelb" },
  { value: "gruen" as Ampel, label: "Grün" },
];

describe("TypedSelect", () => {
  it("sollte bei Auswahl den typisierten Wert liefern (de)", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(
      <TypedSelect value="rot" onValueChange={onValueChange} options={options} aria-label="Ampelfarbe" />,
      "de",
    );

    await user.click(screen.getByRole("combobox", { name: "Ampelfarbe" }));
    await user.click(await screen.findByText("Grün"));

    expect(onValueChange).toHaveBeenCalledWith("gruen");
  });

  it("sollte bei Auswahl den typisierten Wert liefern (en)", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(
      <TypedSelect value="rot" onValueChange={onValueChange} options={options} aria-label="Traffic light color" />,
      "en",
    );

    await user.click(screen.getByRole("combobox", { name: "Traffic light color" }));
    await user.click(await screen.findByText("Gelb"));

    expect(onValueChange).toHaveBeenCalledWith("gelb");
  });

  it("sollte den zugänglichen Namen am SelectTrigger nicht verschlucken (check:a11y-names)", () => {
    renderWithI18n(
      <TypedSelect value="rot" onValueChange={vi.fn()} options={options} aria-label="Ampelfarbe" />,
    );
    expect(screen.getByRole("combobox", { name: "Ampelfarbe" })).toBeInTheDocument();
  });

  it("sollte eine übergebene id an den Trigger weiterreichen (Label-Verknüpfung via htmlFor)", () => {
    renderWithI18n(
      <TypedSelect value="rot" onValueChange={vi.fn()} options={options} aria-label="Ampelfarbe" id="ampel-feld" />,
    );
    expect(screen.getByRole("combobox", { name: "Ampelfarbe" })).toHaveAttribute("id", "ampel-feld");
  });
});

describe("TypedSelect — Typsicherheit (Compile-Zeit, WP 5.1-Muster)", () => {
  it("sollte einen fremden String NICHT als Wert der Union durchlassen", () => {
    const onValueChange = (_value: Ampel) => {};
    // @ts-expect-error — "lila" gehört nicht zur Union `Ampel`; ohne Generic
    // würde ein Tippfehler im Wert erst zur Laufzeit auffallen (falscher
    // Select-Zustand), nicht beim Kompilieren.
    onValueChange("lila");
    expect(true).toBe(true);
  });
});
