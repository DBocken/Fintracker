import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@/i18n/I18nProvider";
import { translations } from "@/i18n/translations";
import MilestonesStrip from "../MilestonesStrip";
import type { MilestoneStatus } from "@/services/milestones-service";

function milestone(over: Partial<MilestoneStatus> = {}): MilestoneStatus {
  return {
    definition: {
      key: "first-1k",
      title: "Erste 1.000 €",
      description: "Netto-Vermögen über 1.000 €",
      icon: "💰",
      isAchieved: () => true,
    },
    achieved: true,
    justAchieved: false,
    ...over,
  };
}

function renderWithI18n(component: any, locale: "de" | "en" = "de") {
  return render(
    <I18nProvider initialLocale={locale}>
      {component}
    </I18nProvider>
  );
}

describe("MilestonesStrip", () => {
  describe("Celebration", () => {
    it("sollte den Erfolgs-Burst nur zeigen, wenn ein Meilenstein gerade erreicht wurde", () => {
      const { container } = renderWithI18n(
        <MilestonesStrip milestones={[milestone({ justAchieved: true })]} />,
        "de"
      );
      expect(screen.getByText(translations.de.milestones.justAchieved)).toBeInTheDocument();
      // CelebrationBurst ist ein SVG mit 12 Strahlen (Default).
      expect(container.querySelectorAll("line").length).toBe(12);
    });

    it("sollte ohne frisch erreichten Meilenstein keinen Burst rendern", () => {
      const { container } = renderWithI18n(
        <MilestonesStrip milestones={[milestone({ justAchieved: false })]} />,
        "de"
      );
      expect(screen.queryByText(translations.de.milestones.achieved)).not.toBeInTheDocument();
      expect(container.querySelectorAll("line").length).toBe(0);
    });
  });

  describe("Regression Protection", () => {
    it("[REGRESSION] sollte erreichte und offene Meilensteine im Pfad darstellen", () => {
      renderWithI18n(
        <MilestonesStrip
          milestones={[
            milestone({ achieved: true }),
            milestone({
              definition: { ...milestone().definition, key: "next", title: "Nächstes Ziel" },
              achieved: false,
            }),
          ]}
        />,
        "de"
      );
      expect(screen.getByText("Nächstes Ziel")).toBeInTheDocument();
    });

    it("[REGRESSION] sollte alle i18n-Keys in beiden Sprachen haben", () => {
      const requiredKeys = ["milestones.justAchieved", "health.lastAchieved", "health.nextGoal"];

      requiredKeys.forEach((key) => {
        const path = key.split(".");
        let deValue: any = translations.de;
        let enValue: any = translations.en;

        path.forEach((p) => {
          const deHas = deValue && typeof deValue === "object" && p in deValue;
          const enHas = enValue && typeof enValue === "object" && p in enValue;
          expect(deHas).toBe(true);
          expect(enHas).toBe(true);
          deValue = deValue[p];
          enValue = enValue[p];
        });

        expect(typeof deValue).toBe("string");
        expect(typeof enValue).toBe("string");
      });
    });

    it("should render milestone achieved in English", () => {
      const { container } = renderWithI18n(
        <MilestonesStrip milestones={[milestone({ justAchieved: true })]} />,
        "en"
      );
      expect(screen.getByText(translations.en.milestones.justAchieved)).toBeInTheDocument();
      expect(container.querySelectorAll("line").length).toBe(12);
    });
  });
});
