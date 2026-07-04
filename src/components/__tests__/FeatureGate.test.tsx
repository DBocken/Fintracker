import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@/i18n/I18nProvider";

// FeatureGate liest Tier (useTier) und Auth-Status (useAuth). Beide werden hier
// gemockt, damit das Gating-Verhalten isoliert (ohne echten AuthProvider/Supabase)
// geprüft werden kann.
const tierMock = vi.fn();
const authMock = vi.fn();

vi.mock("@/hooks/useTier", () => ({ useTier: () => tierMock() }));
vi.mock("@/components/providers/AuthProvider", () => ({ useAuth: () => authMock() }));

import { FeatureGate } from "@/components/FeatureGate";

// Helper: Render mit I18nProvider wrapper
function renderWithI18n(component: React.ReactElement, locale: 'de' | 'en' = 'de') {
  return render(
    <I18nProvider initialLocale={locale}>
      {component}
    </I18nProvider>
  );
}

describe("FeatureGate", () => {
  beforeEach(() => {
    tierMock.mockReset();
    authMock.mockReset();
    authMock.mockReturnValue({ status: "authenticated" });
  });

  describe("Normal Behavior", () => {
    it("sollte children rendern, wenn das Tier das Feature abdeckt", () => {
      tierMock.mockReturnValue("premium");
      renderWithI18n(
        <FeatureGate feature="budgetPremium">
          <div>Premium-Inhalt</div>
        </FeatureGate>,
        'de'
      );
      expect(screen.getByText("Premium-Inhalt")).toBeTruthy();
    });

    it("should render children when tier supports feature (English)", () => {
      tierMock.mockReturnValue("premium");
      renderWithI18n(
        <FeatureGate feature="budgetPremium">
          <div>Premium-Inhalt</div>
        </FeatureGate>,
        'en'
      );
      expect(screen.getByText("Premium-Inhalt")).toBeTruthy();
    });

    it("sollte den Fallback rendern, wenn das Tier das Feature nicht abdeckt", () => {
      tierMock.mockReturnValue("free");
      renderWithI18n(
        <FeatureGate feature="budgetPremium" fallback={<div>Gesperrt</div>}>
          <div>Premium-Inhalt</div>
        </FeatureGate>,
        'de'
      );
      expect(screen.queryByText("Premium-Inhalt")).toBeNull();
      expect(screen.getByText("Gesperrt")).toBeTruthy();
    });

    it("should render fallback when tier doesn't support feature (English)", () => {
      tierMock.mockReturnValue("free");
      renderWithI18n(
        <FeatureGate feature="budgetPremium" fallback={<div>Gesperrt</div>}>
          <div>Premium-Inhalt</div>
        </FeatureGate>,
        'en'
      );
      expect(screen.queryByText("Premium-Inhalt")).toBeNull();
      expect(screen.getByText("Gesperrt")).toBeTruthy();
    });
  });

  describe("Regression Protection", () => {
    it("[REGRESSION] sollte während des Auth-Ladens nichts rendern (kein Aufblitzen)", () => {
      tierMock.mockReturnValue("premium");
      authMock.mockReturnValue({ status: "loading" });
      const { container } = renderWithI18n(
        <FeatureGate feature="budgetPremium">
          <div>Premium-Inhalt</div>
        </FeatureGate>,
        'de'
      );
      expect(screen.queryByText("Premium-Inhalt")).toBeNull();
      expect(container.textContent).toBe("");
    });
  });
});
