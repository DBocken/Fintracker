import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CoachPage from "@/pages/CoachPage";

// Der Orchestrator wird isoliert getestet: die schweren Varianten und der
// Daten-Hook sind gemockt, damit ausschließlich die Modus-Verzweigung geprüft
// wird — der Kernbeweis, dass nur EINE Variante mountet.
const state = vi.hoisted(() => ({
  mode: "desktop" as "desktop" | "mobile",
  data: {
    coach: { recommendations: [{ id: "r1" }, { id: "r2" }], stage: {}, debtSummary: { totalDebt: 0 } },
    health: { score: 70 },
    milestones: [],
    hasData: true as boolean | undefined,
    coachLoading: false,
    milestonesLoading: false,
  },
}));

vi.mock("@/components/providers/LayoutModeProvider", () => ({
  useLayoutMode: () => ({ mode: state.mode, isForced: false }),
}));
vi.mock("@/hooks/data/useCoachOverview", () => ({
  useCoachOverview: () => state.data,
}));
vi.mock("@/i18n/useI18n", () => ({ useI18n: () => ({ t: (k: string) => k }) }));
vi.mock("@/components/coach/CoachDesktopView", () => ({
  default: () => <div data-testid="coach-desktop" />,
}));
vi.mock("@/components/coach/CoachMobileView", () => ({
  default: () => <div data-testid="coach-mobile" />,
}));
// Leerzustand-Kette leichtgewichtig halten.
vi.mock("@/components/common/PageHeader", () => ({ default: () => <div /> }));
vi.mock("@/components/health-score/FinancialLandscape", () => ({ default: () => <div /> }));
vi.mock("@/components/common/FinanceEmptyState", () => ({ default: () => <div data-testid="empty" /> }));

describe("CoachPage Orchestrator", () => {
  beforeEach(() => {
    state.mode = "desktop";
    state.data.hasData = true;
  });

  describe("Modus-Verzweigung (nur EINE Variante mountet)", () => {
    it("[MOBILE] sollte im Mobile-Modus nur die Mobile-Variante mounten", () => {
      state.mode = "mobile";
      render(<CoachPage />);
      expect(screen.getByTestId("coach-mobile")).toBeInTheDocument();
      // Desktop-Variante darf NICHT im DOM sein (kein CSS-Doppelrender).
      expect(screen.queryByTestId("coach-desktop")).not.toBeInTheDocument();
    });

    it("[REGRESSION] sollte im Desktop-Modus nur die Desktop-Variante mounten", () => {
      state.mode = "desktop";
      render(<CoachPage />);
      expect(screen.getByTestId("coach-desktop")).toBeInTheDocument();
      expect(screen.queryByTestId("coach-mobile")).not.toBeInTheDocument();
    });
  });

  describe("Leerzustand", () => {
    it("sollte ohne Finanzdaten den Empty-State statt einer Variante zeigen", () => {
      state.data.hasData = false;
      render(<CoachPage />);
      expect(screen.getByTestId("empty")).toBeInTheDocument();
      expect(screen.queryByTestId("coach-desktop")).not.toBeInTheDocument();
      expect(screen.queryByTestId("coach-mobile")).not.toBeInTheDocument();
    });
  });
});
