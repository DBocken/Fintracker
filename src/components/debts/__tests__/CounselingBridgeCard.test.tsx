import { render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import { CounselingBridgeCard } from "../CounselingBridgeCard";
import {
  getCounselingServices,
  getCommercialRegulatorWarning,
  type CounselingRecommendation,
} from "@/services/debt-guardrails-service";

function renderWithI18n(component: React.ReactElement, locale: "de" | "en" = "de") {
  return render(<I18nProvider initialLocale={locale}>{component}</I18nProvider>);
}

let recommended: CounselingRecommendation;

beforeEach(() => {
  // Set locale for serviceT
  window.localStorage.setItem("ausgabentracker_locale_v1", "de");
  recommended = {
    recommended: true,
    reason: "Dein Plan dauert länger als 6 Jahre.",
    services: getCounselingServices(),
    warning: getCommercialRegulatorWarning(),
  };
});

afterEach(() => {
  window.localStorage.removeItem("ausgabentracker_locale_v1");
});

describe("CounselingBridgeCard", () => {
  describe("Normal Behavior", () => {
    it("sollte Grund, kostenlose Stellen (mit Links) und Warnung anzeigen", () => {
      renderWithI18n(<CounselingBridgeCard recommendation={recommended} />);

      expect(screen.getByText("Dein Plan dauert länger als 6 Jahre.")).toBeInTheDocument();
      const services = getCounselingServices();
      for (const s of services) {
        const link = screen.getByRole("link", { name: new RegExp(s.name) });
        expect(link).toHaveAttribute("href", s.url);
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
      }
      expect(screen.getByText(getCommercialRegulatorWarning())).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("sollte nichts rendern, wenn keine Empfehlung vorliegt", () => {
      const { container } = renderWithI18n(
        <CounselingBridgeCard
          recommendation={{
            recommended: false,
            reason: null,
            services: getCounselingServices(),
            warning: getCommercialRegulatorWarning(),
          }}
        />,
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("English Locale", () => {
    it("sollte englische Texte rendern", () => {
      window.localStorage.setItem("ausgabentracker_locale_v1", "en");
      const enRecommended = {
        recommended: true,
        reason: "Your plan lasts longer than 6 years.",
        services: getCounselingServices(),
        warning: getCommercialRegulatorWarning(),
      };
      renderWithI18n(<CounselingBridgeCard recommendation={enRecommended} />, "en");
      expect(screen.getByText("Get free support")).toBeInTheDocument();
      window.localStorage.removeItem("ausgabentracker_locale_v1");
    });
  });
});
