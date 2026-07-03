import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CoachMobileView from "@/components/coach/CoachMobileView";
import type { CoachViewProps } from "@/components/coach/coach-view";

// UI-Kontext + datenschwere Blattkomponenten mocken: dieser Test prüft NUR die
// Hub-/Disclosure-Struktur der Mobile-Variante, nicht die Kinder.
vi.mock("@/i18n/useI18n", () => ({ useI18n: () => ({ t: (k: string) => k }) }));
vi.mock("@/components/providers/GentleModeProvider", () => ({
  useGentleMode: () => ({ enabled: false }),
}));
vi.mock("@/components/coach/CoachFeedCard", () => ({ default: () => <div /> }));
vi.mock("@/components/coach/CoachStatusGrid", () => ({ default: () => <div data-testid="status-grid" /> }));
vi.mock("@/components/coach/FoundationLadder", () => ({ default: () => <div /> }));
vi.mock("@/components/coach/DisposableTankCard", () => ({ default: () => <div /> }));
vi.mock("@/components/coach/UpcomingChargesList", () => ({ default: () => <div /> }));
vi.mock("@/components/coach/CategorySuggestionsInbox", () => ({ default: () => <div /> }));
vi.mock("@/components/health-score/FinancialLandscape", () => ({ default: () => <div /> }));
vi.mock("@/components/common/PageHeader", () => ({ default: () => <div /> }));

function baseProps(overrides: Partial<CoachViewProps> = {}): CoachViewProps {
  return {
    coach: { debtSummary: { totalDebt: 0 }, stage: { title: "Stufe 1" } } as CoachViewProps["coach"],
    health: { score: 70 } as CoachViewProps["health"],
    milestones: [],
    focusCard: undefined,
    followUps: [],
    coachLoading: false,
    milestonesLoading: false,
    ...overrides,
  };
}

function renderView(props: CoachViewProps) {
  return render(
    <MemoryRouter>
      <CoachMobileView {...props} />
    </MemoryRouter>,
  );
}

describe("CoachMobileView", () => {
  describe("Ebene 1 — eine Kernaussage", () => {
    it("[MOBILE] sollte ohne Fokusempfehlung die 'alles gut'-Schlagzeile zeigen", () => {
      renderView(baseProps());
      expect(screen.getByText("coach.allGood")).toBeInTheDocument();
      // Glanceable Statusraster (Ebene 2 inline) ist vorhanden.
      expect(screen.getByTestId("status-grid")).toBeInTheDocument();
    });
  });

  describe("Ebene 3 — Spokes führen zu Vollansichten", () => {
    it("[MOBILE] sollte Spoke-Links zu Liquidität, Meilensteinen und Dashboard rendern", () => {
      renderView(baseProps());
      const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
      expect(hrefs).toContain("/liquidity");
      expect(hrefs).toContain("/milestones");
      expect(hrefs).toContain("/dashboard");
      // Ohne Schulden führt der Vermögens-Spoke zu /net-worth (nicht /debts).
      expect(hrefs).toContain("/net-worth");
    });

    it("[MOBILE] sollte bei offenen Schulden zum Schulden-Spoke verlinken", () => {
      renderView(
        baseProps({
          coach: { debtSummary: { totalDebt: 1200 }, stage: { title: "Stufe 1" } } as CoachViewProps["coach"],
        }),
      );
      const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
      expect(hrefs).toContain("/debts");
      expect(hrefs).not.toContain("/net-worth");
    });
  });
});
