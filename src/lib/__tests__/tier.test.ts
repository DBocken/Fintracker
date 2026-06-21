import { describe, expect, it } from "vitest";
import { FEATURES, deriveTier, hasFeatureAccess, tierMeets, type Tier } from "../tier";

describe("tierMeets", () => {
  const tiers: Tier[] = ["anonymous", "free", "premium"];

  it("is true when the user's tier is exactly the required tier", () => {
    for (const tier of tiers) {
      expect(tierMeets(tier, tier)).toBe(true);
    }
  });

  it("is true when the user's tier is higher than required", () => {
    expect(tierMeets("free", "anonymous")).toBe(true);
    expect(tierMeets("premium", "anonymous")).toBe(true);
    expect(tierMeets("premium", "free")).toBe(true);
  });

  it("is false when the user's tier is lower than required", () => {
    expect(tierMeets("anonymous", "free")).toBe(false);
    expect(tierMeets("anonymous", "premium")).toBe(false);
    expect(tierMeets("free", "premium")).toBe(false);
  });
});

describe("hasFeatureAccess", () => {
  it("grants bankSync to free and premium users, but not anonymous", () => {
    expect(hasFeatureAccess("anonymous", "bankSync")).toBe(false);
    expect(hasFeatureAccess("free", "bankSync")).toBe(true);
    expect(hasFeatureAccess("premium", "bankSync")).toBe(true);
  });

  it("restricts premium-only features to the premium tier", () => {
    const premiumFeatures = (Object.keys(FEATURES) as Array<keyof typeof FEATURES>).filter(
      (key) => FEATURES[key] === "premium",
    );

    for (const feature of premiumFeatures) {
      expect(hasFeatureAccess("anonymous", feature)).toBe(false);
      expect(hasFeatureAccess("free", feature)).toBe(false);
      expect(hasFeatureAccess("premium", feature)).toBe(true);
    }
  });

  it("includes premiumAnalytics, simulation, trading and splitTransactions as premium-gated features", () => {
    expect(FEATURES.premiumAnalytics).toBe("premium");
    expect(FEATURES.simulation).toBe("premium");
    expect(FEATURES.trading).toBe("premium");
    expect(FEATURES.splitTransactions).toBe("premium");
  });
});

describe("deriveTier", () => {
  it("derives 'free' for authenticated users (premium not yet purchasable)", () => {
    expect(deriveTier("authenticated")).toBe("free");
  });

  it("derives 'anonymous' for unauthenticated users", () => {
    expect(deriveTier("unauthenticated")).toBe("anonymous");
  });

  it("derives 'anonymous' while loading, to avoid flashing premium content", () => {
    expect(deriveTier("loading")).toBe("anonymous");
  });

  it("never derives 'premium', since the paywall is not yet implemented", () => {
    const statuses: Array<Parameters<typeof deriveTier>[0]> = [
      "loading",
      "authenticated",
      "unauthenticated",
    ];
    for (const status of statuses) {
      expect(deriveTier(status)).not.toBe("premium");
    }
  });
});
