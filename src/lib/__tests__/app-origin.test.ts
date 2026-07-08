import { describe, it, expect, vi } from "vitest";
import { PRODUCTION_APP_ORIGIN, getRedirectOrigin } from "@/lib/app-origin";

describe("app-origin", () => {
  it("exposes the production origin constant", () => {
    expect(PRODUCTION_APP_ORIGIN).toBe("https://fintracker-phi.vercel.app");
  });

  it("uses the current origin on localhost (jsdom default)", () => {
    // jsdom serves on localhost, so the dev branch returns window.location.origin.
    expect(window.location.hostname).toBe("localhost");
    expect(getRedirectOrigin()).toBe(window.location.origin);
  });

  it("returns the production origin for a non-localhost hostname", () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, hostname: "app.example.com", origin: "https://app.example.com" },
      configurable: true,
      writable: true,
    });
    try {
      expect(getRedirectOrigin()).toBe(PRODUCTION_APP_ORIGIN);
    } finally {
      Object.defineProperty(window, "location", { value: originalLocation, configurable: true, writable: true });
    }
  });

  it("returns the production origin when window is undefined (SSR)", () => {
    vi.stubGlobal("window", undefined);
    try {
      expect(getRedirectOrigin()).toBe(PRODUCTION_APP_ORIGIN);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
