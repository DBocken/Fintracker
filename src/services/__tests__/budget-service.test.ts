import { describe, it, expect } from "vitest";
import { currentMonthKey, currentPeriodKey, lastNMonths } from "@/services/budget-service";

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

  describe("currentPeriodKey (#133 flexible Perioden)", () => {
    const ref = new Date(2026, 5, 15); // 15. Juni 2026 (Monat 0-basiert)

    it("sollte monatlich den Monatsschlüssel liefern (Default)", () => {
      expect(currentPeriodKey("monthly", ref)).toBe("2026-06");
      expect(currentPeriodKey(undefined, ref)).toBe(currentMonthKey(ref));
    });
    it("sollte jährlich nur das Jahr liefern", () => {
      expect(currentPeriodKey("yearly", ref)).toBe("2026");
    });
    it("sollte wöchentlich einen ISO-Wochenschlüssel liefern", () => {
      expect(currentPeriodKey("weekly", ref)).toMatch(/^\d{4}-W\d{2}$/);
    });
  });
});
