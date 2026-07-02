import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

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

  it("sollte children rendern, wenn das Tier das Feature abdeckt", () => {
    tierMock.mockReturnValue("premium");
    render(
      <FeatureGate feature="budgetPremium">
        <div>Premium-Inhalt</div>
      </FeatureGate>,
    );
    expect(screen.getByText("Premium-Inhalt")).toBeTruthy();
  });

  it("sollte den Fallback rendern, wenn das Tier das Feature nicht abdeckt", () => {
    tierMock.mockReturnValue("free");
    render(
      <FeatureGate feature="budgetPremium" fallback={<div>Gesperrt</div>}>
        <div>Premium-Inhalt</div>
      </FeatureGate>,
    );
    expect(screen.queryByText("Premium-Inhalt")).toBeNull();
    expect(screen.getByText("Gesperrt")).toBeTruthy();
  });

  it("[REGRESSION] sollte während des Auth-Ladens nichts rendern (kein Aufblitzen)", () => {
    tierMock.mockReturnValue("premium");
    authMock.mockReturnValue({ status: "loading" });
    const { container } = render(
      <FeatureGate feature="budgetPremium">
        <div>Premium-Inhalt</div>
      </FeatureGate>,
    );
    expect(screen.queryByText("Premium-Inhalt")).toBeNull();
    expect(container.textContent).toBe("");
  });
});
