import { describe, it, expect } from "vitest";
import { lastNMonths } from "@/services/budget-service";

describe("budget-service", () => {
  describe("lastNMonths", () => {
    it("sollte die letzten n Monate inkl. Bezugsmonat chronologisch liefern", () => {
      expect(lastNMonths("2026-06", 3)).toEqual(["2026-04", "2026-05", "2026-06"]);
    });
    it("sollte über die Jahresgrenze rechnen", () => {
      expect(lastNMonths("2026-01", 3)).toEqual(["2025-11", "2025-12", "2026-01"]);
    });
    it("sollte mit n=1 nur den Bezugsmonat liefern", () => {
      expect(lastNMonths("2026-06", 1)).toEqual(["2026-06"]);
    });
  });
});
