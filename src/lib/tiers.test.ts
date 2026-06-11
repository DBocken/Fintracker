import { describe, expect, it } from "vitest";

import {
  FEATURE_TIERS,
  isFeatureEnabled,
  requiredTierFor,
  resolveTier,
  tierSatisfies,
  type FeatureKey,
  type Tier,
} from "./tiers";

describe("resolveTier", () => {
  it("liefert anonymous ohne Anmeldung", () => {
    expect(resolveTier(false)).toBe("anonymous");
    // Entitlement ohne Login ist wirkungslos — Premium setzt Login voraus
    expect(resolveTier(false, true)).toBe("anonymous");
  });

  it("liefert free für eingeloggte Nutzer ohne Entitlement", () => {
    expect(resolveTier(true)).toBe("free");
    expect(resolveTier(true, false)).toBe("free");
  });

  it("liefert premium nur mit Login + Entitlement", () => {
    expect(resolveTier(true, true)).toBe("premium");
  });
});

describe("tierSatisfies", () => {
  const cases: Array<[Tier, Tier, boolean]> = [
    ["anonymous", "anonymous", true],
    ["anonymous", "free", false],
    ["anonymous", "premium", false],
    ["free", "anonymous", true],
    ["free", "free", true],
    ["free", "premium", false],
    ["premium", "anonymous", true],
    ["premium", "free", true],
    ["premium", "premium", true],
  ];

  it.each(cases)("%s erfüllt %s → %s", (current, required, expected) => {
    expect(tierSatisfies(current, required)).toBe(expected);
  });
});

describe("FEATURE_TIERS / requiredTierFor", () => {
  it("alle rein lokalen Kern-Features sind anonym nutzbar", () => {
    const localFeatures: FeatureKey[] = [
      "csv_import",
      "dashboard",
      "coach",
      "debts",
      "net_worth",
      "categories",
      "export",
      "backups",
      "local_encryption",
    ];
    for (const f of localFeatures) {
      expect(requiredTierFor(f)).toBe("anonymous");
    }
  });

  it("Features mit Server-Identität brauchen mindestens free", () => {
    expect(requiredTierFor("bank_sync")).toBe("free");
    expect(requiredTierFor("profile")).toBe("free");
    expect(requiredTierFor("cloud_settings")).toBe("free");
  });

  it("Bezahl-Features sind als premium markiert", () => {
    expect(requiredTierFor("premium_analytics")).toBe("premium");
    expect(requiredTierFor("simulation")).toBe("premium");
    expect(requiredTierFor("trading")).toBe("premium");
  });

  it("jedes Feature hat genau ein gültiges Tier", () => {
    for (const tier of Object.values(FEATURE_TIERS)) {
      expect(["anonymous", "free", "premium"]).toContain(tier);
    }
  });
});

describe("isFeatureEnabled", () => {
  it("anonymous darf lokale Features nutzen", () => {
    expect(isFeatureEnabled("csv_import", "anonymous")).toBe(true);
    expect(isFeatureEnabled("debts", "anonymous")).toBe(true);
  });

  it("anonymous darf keine Features mit Server-Identität nutzen", () => {
    expect(isFeatureEnabled("bank_sync", "anonymous")).toBe(false);
    expect(isFeatureEnabled("profile", "anonymous")).toBe(false);
  });

  it("free darf bank_sync nutzen", () => {
    expect(isFeatureEnabled("bank_sync", "free")).toBe(true);
  });

  describe("Premium-Gating (Issue #53 schaltet scharf)", () => {
    it("ohne Enforcement sind Premium-Features für alle offen", () => {
      expect(isFeatureEnabled("premium_analytics", "anonymous", false)).toBe(true);
      expect(isFeatureEnabled("simulation", "free", false)).toBe(true);
      expect(isFeatureEnabled("trading", "anonymous", false)).toBe(true);
    });

    it("mit Enforcement sind Premium-Features nur für premium offen", () => {
      expect(isFeatureEnabled("premium_analytics", "anonymous", true)).toBe(false);
      expect(isFeatureEnabled("premium_analytics", "free", true)).toBe(false);
      expect(isFeatureEnabled("premium_analytics", "premium", true)).toBe(true);
    });

    it("Enforcement ändert nichts an free-Features", () => {
      expect(isFeatureEnabled("bank_sync", "anonymous", true)).toBe(false);
      expect(isFeatureEnabled("bank_sync", "free", true)).toBe(true);
    });
  });
});
