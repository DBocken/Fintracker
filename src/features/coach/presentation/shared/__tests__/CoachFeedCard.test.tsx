import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/i18n/I18nProvider";
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

function renderCard(card: CoachRecommendation, featured = false, locale: 'de' | 'en' = 'de') {
  localStorage.setItem('ausgabentracker_locale_v1', locale);
  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter>
        <CoachFeedCard card={card} index={0} featured={featured} />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("CoachFeedCard", () => {
  describe("German locale", () => {
    describe("Normal Behavior", () => {
      it("sollte Titel, Nachricht und Begründung anzeigen", () => {
        renderCard(makeCard(), false, 'de');
        expect(screen.getByText("Notgroschen aufbauen")).toBeInTheDocument();
        expect(screen.getByText("Lege 500 € zur Seite.")).toBeInTheDocument();
        expect(screen.getByText("Puffer für Überraschungen.")).toBeInTheDocument();
      });
    });

    describe("Regression Protection", () => {
      it("[REGRESSION] sollte mit CTA die GANZE Karte klickbar machen (Link auf ctaTo)", () => {
        renderCard(makeCard({ ctaLabel: "Sparziel anlegen", ctaTo: "/budgets" }), false, 'de');
        const link = screen.getByRole("link");
        expect(link).toHaveAttribute("href", "/budgets");
        // Kernfix: der Titel liegt INNERHALB der klickbaren Fläche, nicht nur ein Button.
        expect(link).toContainElement(screen.getByText("Notgroschen aufbauen"));
      });

      it("[REGRESSION] sollte ohne CTA KEINE klickbare Karte sein (kein Link)", () => {
        renderCard(makeCard({ ctaLabel: undefined, ctaTo: undefined }), false, 'de');
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
        // Inhalt bleibt sichtbar – nur eben ohne Klick-Versprechen.
        expect(screen.getByText("Notgroschen aufbauen")).toBeInTheDocument();
      });

      it("sollte featured Badge auf Deutsch anzeigen", () => {
        renderCard(makeCard(), true, 'de');
        expect(screen.getByText("Wichtigste Aktion heute")).toBeInTheDocument();
      });
    });
  });

  describe("English locale", () => {
    it("should display title, message and reason", () => {
      renderCard(makeCard(), false, 'en');
      expect(screen.getByText("Notgroschen aufbauen")).toBeInTheDocument();
      expect(screen.getByText("Lege 500 € zur Seite.")).toBeInTheDocument();
      expect(screen.getByText("Puffer für Überraschungen.")).toBeInTheDocument();
    });

    it("[REGRESSION] should make whole card clickable with CTA (link to ctaTo)", () => {
      renderCard(makeCard({ ctaLabel: "Create savings goal", ctaTo: "/budgets" }), false, 'en');
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/budgets");
      // Card title is within clickable area, not just a button.
      expect(link).toContainElement(screen.getByText("Notgroschen aufbauen"));
    });

    it("[REGRESSION] should NOT be clickable card without CTA (no link)", () => {
      renderCard(makeCard({ ctaLabel: undefined, ctaTo: undefined }), false, 'en');
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      // Content remains visible – just without click promise.
      expect(screen.getByText("Notgroschen aufbauen")).toBeInTheDocument();
    });

    it("should display featured badge in English", () => {
      renderCard(makeCard(), true, 'en');
      expect(screen.getByText("Top action today")).toBeInTheDocument();
    });
  });
});
