import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CounselingBridgeCard } from "../CounselingBridgeCard";
import {
  COUNSELING_SERVICES,
  COMMERCIAL_REGULATOR_WARNING,
  type CounselingRecommendation,
} from "@/services/debt-guardrails-service";

const recommended: CounselingRecommendation = {
  recommended: true,
  reason: "Dein Plan dauert länger als 6 Jahre.",
  services: COUNSELING_SERVICES,
  warning: COMMERCIAL_REGULATOR_WARNING,
};

describe("CounselingBridgeCard", () => {
  describe("Normal Behavior", () => {
    it("sollte Grund, kostenlose Stellen (mit Links) und Warnung anzeigen", () => {
      render(<CounselingBridgeCard recommendation={recommended} />);

      expect(screen.getByText("Dein Plan dauert länger als 6 Jahre.")).toBeInTheDocument();
      for (const s of COUNSELING_SERVICES) {
        const link = screen.getByRole("link", { name: new RegExp(s.name) });
        expect(link).toHaveAttribute("href", s.url);
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
      }
      expect(screen.getByText(COMMERCIAL_REGULATOR_WARNING)).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("sollte nichts rendern, wenn keine Empfehlung vorliegt", () => {
      const { container } = render(
        <CounselingBridgeCard
          recommendation={{
            recommended: false,
            reason: null,
            services: COUNSELING_SERVICES,
            warning: COMMERCIAL_REGULATOR_WARNING,
          }}
        />,
      );
      expect(container).toBeEmptyDOMElement();
    });
  });
});
