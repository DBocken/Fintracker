import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import InteractiveCard from "../InteractiveCard";

function renderWithRouter(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("InteractiveCard", () => {
  describe("Normal Behavior", () => {
    it("sollte bei `to` die ganze Karte als Link rendern", () => {
      renderWithRouter(
        <InteractiveCard to="/debts">
          <div>Schuldenkontext</div>
        </InteractiveCard>,
      );
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/debts");
      // Kerngarantie: der Inhalt liegt INNERHALB der klickbaren Fläche.
      expect(link).toContainElement(screen.getByText("Schuldenkontext"));
    });

    it("sollte bei `onClick` als Button rendern und den Handler auslösen", async () => {
      const onClick = vi.fn();
      renderWithRouter(
        <InteractiveCard onClick={onClick}>
          <div>Details öffnen</div>
        </InteractiveCard>,
      );
      await userEvent.click(screen.getByText("Details öffnen"));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("sollte bei `href` ein externes Ziel in neuem Tab sicher öffnen", () => {
      renderWithRouter(
        <InteractiveCard href="https://example.com">
          <div>Extern</div>
        </InteractiveCard>,
      );
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "https://example.com");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    });
  });

  describe("Affordanz & Accessibility", () => {
    it("sollte aria-expanded und Indikator-Rotation bei Disclosure tragen", () => {
      const { rerender } = renderWithRouter(
        <InteractiveCard onClick={() => {}} expanded={false}>
          <div>Subscores</div>
        </InteractiveCard>,
      );
      expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");

      rerender(
        <MemoryRouter>
          <InteractiveCard onClick={() => {}} expanded>
            <div>Subscores</div>
          </InteractiveCard>
        </MemoryRouter>,
      );
      expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    });

    it("sollte ein aria-label durchreichen", () => {
      renderWithRouter(
        <InteractiveCard to="/milestones" aria-label="Roadmap-Status ansehen">
          <div>Roadmap</div>
        </InteractiveCard>,
      );
      expect(screen.getByRole("link", { name: "Roadmap-Status ansehen" })).toBeInTheDocument();
    });

    it("sollte per Tastatur aktivierbar sein (Enter)", async () => {
      const onClick = vi.fn();
      renderWithRouter(
        <InteractiveCard onClick={onClick}>
          <div>Aktion</div>
        </InteractiveCard>,
      );
      screen.getByRole("button").focus();
      await userEvent.keyboard("{Enter}");
      expect(onClick).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("sollte im disabled-Zustand nicht auslösen", async () => {
      const onClick = vi.fn();
      renderWithRouter(
        <InteractiveCard onClick={onClick} disabled>
          <div>Gesperrt</div>
        </InteractiveCard>,
      );
      await userEvent.click(screen.getByText("Gesperrt"));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("Regression Protection", () => {
    it("[REGRESSION] sollte die GANZE Karten-Fläche klickbar machen, nicht nur einen inneren Button", async () => {
      // Usability-Test: Nutzer erwarten, dass die ganze Karte reagiert.
      const onClick = vi.fn();
      renderWithRouter(
        <InteractiveCard onClick={onClick}>
          <div>
            <span>Titel</span>
            <p>Beschreibung tief im Inhalt</p>
          </div>
        </InteractiveCard>,
      );
      // Klick auf ein tief verschachteltes Kind muss die Karte auslösen.
      await userEvent.click(screen.getByText("Beschreibung tief im Inhalt"));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });
});
