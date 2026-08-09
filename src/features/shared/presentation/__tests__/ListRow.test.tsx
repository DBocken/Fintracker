import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ListRow from "../ListRow";

describe("ListRow", () => {
  describe("Normal Behavior", () => {
    it("sollte Titel, Untertitel und Wert anzeigen", () => {
      render(<ListRow icon="🛒" title="REWE" subtitle="21.06.2026 · Lebensmittel" value="-12,34 €" />);
      expect(screen.getByText("REWE")).toBeInTheDocument();
      expect(screen.getByText("21.06.2026 · Lebensmittel")).toBeInTheDocument();
      expect(screen.getByText("-12,34 €")).toBeInTheDocument();
    });

    it("sollte als Button rendern und onClick auslösen, wenn onClick gesetzt ist", () => {
      const onClick = vi.fn();
      render(<ListRow title="Girokonto" value="425,35 €" onClick={onClick} />);
      fireEvent.click(screen.getByRole("button", { name: /Girokonto/i }));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Edge Cases", () => {
    it("sollte ohne onClick keinen Button rendern (statische Zeile)", () => {
      render(<ListRow title="Sparkonto" value="600,00 €" />);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("sollte führende Elemente außerhalb des klickbaren Buttons halten, damit z. B. eine Checkbox die Zeile nicht öffnet", () => {
      const onClick = vi.fn();
      render(
        <ListRow
          title="Auswahlzeile"
          onClick={onClick}
          leading={<input type="checkbox" aria-label="auswählen" />}
        />,
      );
      // Die Checkbox ist ein Geschwister des Buttons, kein Kind – ein Klick darauf
      // darf die Zeilen-Navigation nicht auslösen.
      const checkbox = screen.getByRole("checkbox", { name: "auswählen" });
      const rowButton = screen.getByRole("button", { name: /Auswahlzeile/i });
      expect(rowButton).not.toContainElement(checkbox);
    });
  });
});
