import { describe, it, expect, beforeEach } from "vitest";
import {
  deriveTier,
  getTierOverride,
  setTierOverride,
  clearTierOverride,
  hasFeatureAccess,
  TIER_OVERRIDE_KEY,
} from "./tier";

describe("deriveTier", () => {
  it("leitet ohne Override aus dem Auth-Status ab", () => {
    expect(deriveTier("authenticated")).toBe("free");
    expect(deriveTier("unauthenticated")).toBe("anonymous");
    expect(deriveTier("loading")).toBe("anonymous");
  });

  it("hebt mit Premium-Override auf premium an", () => {
    expect(deriveTier("authenticated", "premium")).toBe("premium");
  });

  it("stuft niemals unter den Basis-Tier herab", () => {
    // free-Override für anonyme Nutzer hebt nicht über anonymous hinaus (Upgrade only)
    expect(deriveTier("authenticated", "free")).toBe("free");
    // premium-Override greift auch ohne Anmeldung nur als Upgrade
    expect(deriveTier("unauthenticated", "premium")).toBe("premium");
  });
});

describe("Tier-Override (localStorage)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("liefert null ohne gesetzten Override", () => {
    expect(getTierOverride()).toBeNull();
  });

  it("schaltet mit korrektem Code premium frei und persistiert", () => {
    expect(setTierOverride("alphatester")).toBe("premium");
    expect(window.localStorage.getItem(TIER_OVERRIDE_KEY)).toBe("premium");
    expect(getTierOverride()).toBe("premium");
  });

  it("akzeptiert den Code unabhängig von Groß-/Kleinschreibung und Leerzeichen", () => {
    expect(setTierOverride("  AlphaTester  ")).toBe("premium");
    expect(getTierOverride()).toBe("premium");
  });

  it("lehnt einen falschen Code ab und persistiert nichts", () => {
    expect(setTierOverride("falsch")).toBeNull();
    expect(getTierOverride()).toBeNull();
  });

  it("entfernt den Override wieder", () => {
    setTierOverride("alphatester");
    clearTierOverride();
    expect(getTierOverride()).toBeNull();
  });

  it("schaltet Premium-Funktionen erst mit gültigem Override frei", () => {
    expect(hasFeatureAccess(deriveTier("authenticated", getTierOverride()), "premiumAnalytics")).toBe(false);
    setTierOverride("alphatester");
    expect(hasFeatureAccess(deriveTier("authenticated", getTierOverride()), "premiumAnalytics")).toBe(true);
  });
});
