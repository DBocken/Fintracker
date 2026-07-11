import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "@/test-utils/render";

// FeatureGate liest Tier (useTier) und Auth-Status (useAuth). Beide werden hier
// gemockt, damit das Gating-Verhalten isoliert (ohne echten AuthProvider/Supabase)
// geprüft werden kann.
const tierMock = vi.fn();
const authMock = vi.fn();

vi.mock("@/hooks/useTier", () => ({ useTier: () => tierMock() }));
vi.mock("@/components/providers/AuthProvider", () => ({ useAuth: () => authMock() }));

import { FeatureGate } from "@/components/FeatureGate";

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

    it("sollte free-Tier Zugriff auf ein free-Feature (bankSync) gewähren", () => {
      tierMock.mockReturnValue("free");
      renderWithI18n(
        <FeatureGate feature="bankSync">
          <div>Bank-Sync</div>
        </FeatureGate>,
        'de'
      );
      expect(screen.getByText("Bank-Sync")).toBeTruthy();
    });

    it("sollte anonymous-Tier vom free-Feature (bankSync) auf den Fallback zeigen", () => {
      tierMock.mockReturnValue("anonymous");
      renderWithI18n(
        <FeatureGate feature="bankSync" fallback={<div>Login nötig</div>}>
          <div>Bank-Sync</div>
        </FeatureGate>,
        'de'
      );
      expect(screen.queryByText("Bank-Sync")).toBeNull();
      expect(screen.getByText("Login nötig")).toBeTruthy();
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
