import { describe, it, expect } from "vitest";
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
});
