import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CoachFeedCard from "../CoachFeedCard";
import type { CoachRecommendation } from "@/types";

function makeCard(overrides: Partial<CoachRecommendation> = {}): CoachRecommendation {
  return {
    id: "rec-1",
    title: "Notgroschen aufbauen",
    message: "Lege 500 € zur Seite.",
    reason: "Puffer für Überraschungen.",
    severity: "info",
    ...overrides,
  };
}

function renderCard(card: CoachRecommendation, featured = false) {
  return render(
    <MemoryRouter>
      <CoachFeedCard card={card} index={0} featured={featured} />
    </MemoryRouter>,
  );
}

describe("CoachFeedCard", () => {
  describe("Normal Behavior", () => {
    it("sollte Titel, Nachricht und Begründung anzeigen", () => {
      renderCard(makeCard());
      expect(screen.getByText("Notgroschen aufbauen")).toBeInTheDocument();
      expect(screen.getByText("Lege 500 € zur Seite.")).toBeInTheDocument();
      expect(screen.getByText("Puffer für Überraschungen.")).toBeInTheDocument();
    });
  });

  describe("Regression Protection", () => {
    it("[REGRESSION] sollte mit CTA die GANZE Karte klickbar machen (Link auf ctaTo)", () => {
      renderCard(makeCard({ ctaLabel: "Sparziel anlegen", ctaTo: "/budgets" }));
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/budgets");
      // Kernfix: der Titel liegt INNERHALB der klickbaren Fläche, nicht nur ein Button.
      expect(link).toContainElement(screen.getByText("Notgroschen aufbauen"));
    });

    it("[REGRESSION] sollte ohne CTA KEINE klickbare Karte sein (kein Link)", () => {
      renderCard(makeCard({ ctaLabel: undefined, ctaTo: undefined }));
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      // Inhalt bleibt sichtbar – nur eben ohne Klick-Versprechen.
      expect(screen.getByText("Notgroschen aufbauen")).toBeInTheDocument();
    });
  });
});
