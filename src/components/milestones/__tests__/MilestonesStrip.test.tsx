import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("MilestonesStrip", () => {
  describe("Celebration", () => {
    it("sollte den Erfolgs-Burst nur zeigen, wenn ein Meilenstein gerade erreicht wurde", () => {
      const { container } = render(
        <MilestonesStrip milestones={[milestone({ justAchieved: true })]} />,
      );
      expect(screen.getByText("Meilenstein erreicht!")).toBeInTheDocument();
      // CelebrationBurst ist ein SVG mit 12 Strahlen (Default).
      expect(container.querySelectorAll("line").length).toBe(12);
    });

    it("sollte ohne frisch erreichten Meilenstein keinen Burst rendern", () => {
      const { container } = render(
        <MilestonesStrip milestones={[milestone({ justAchieved: false })]} />,
      );
      expect(screen.queryByText("Meilenstein erreicht!")).not.toBeInTheDocument();
      expect(container.querySelectorAll("line").length).toBe(0);
    });
  });

  describe("Regression Protection", () => {
    it("[REGRESSION] sollte erreichte und offene Meilensteine im Pfad darstellen", () => {
      render(
        <MilestonesStrip
          milestones={[
            milestone({ achieved: true }),
            milestone({
              definition: { ...milestone().definition, key: "next", title: "Nächstes Ziel" },
              achieved: false,
            }),
          ]}
        />,
      );
      expect(screen.getByText("Nächstes Ziel")).toBeInTheDocument();
    });
  });
});
