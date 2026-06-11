// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { isFeatureEnabled, setFeatureEnabled } from "./feature-flags";

describe("feature-flags", () => {
  beforeEach(() => localStorage.clear());

  it("ist standardmäßig aus", () => {
    expect(isFeatureEnabled("trading_beta")).toBe(false);
  });

  it("lässt sich aktivieren und wieder deaktivieren", () => {
    setFeatureEnabled("trading_beta", true);
    expect(isFeatureEnabled("trading_beta")).toBe(true);
    setFeatureEnabled("trading_beta", false);
    expect(isFeatureEnabled("trading_beta")).toBe(false);
  });
});
