import { describe, expect, it } from "vitest";
import { deltaTone, relativeDelta, deltaToneClass } from "@/lib/delta-color";

describe("delta-color", () => {
  describe("relativeDelta", () => {
    it("sollte relative Veränderung berechnen", () => {
      expect(relativeDelta(110, 100)).toBeCloseTo(0.1);
      expect(relativeDelta(90, 100)).toBeCloseTo(-0.1);
    });
    it("[Edge] sollte Vorwert 0 als ±Infinity behandeln", () => {
      expect(relativeDelta(50, 0)).toBe(Number.POSITIVE_INFINITY);
      expect(relativeDelta(-50, 0)).toBe(Number.NEGATIVE_INFINITY);
      expect(relativeDelta(0, 0)).toBe(0);
    });
  });

  describe("deltaTone — '+5% ist kein Alarm' (Totzone)", () => {
    it("sollte kleine Veränderungen neutral lassen", () => {
      expect(deltaTone(103, 100)).toBe("neutral"); // +3 %
      expect(deltaTone(96, 100)).toBe("neutral"); // −4 %
      expect(deltaTone(100, 100)).toBe("neutral");
    });
  });

  describe("deltaTone — Richtungssinn", () => {
    it("sollte Anstieg beim Vermögen als positiv einfärben", () => {
      expect(deltaTone(120, 100, { increaseIsGood: true })).toBe("positive");
    });
    it("sollte Anstieg bei Ausgaben als Warnung/kritisch einfärben", () => {
      expect(deltaTone(115, 100, { increaseIsGood: false })).toBe("warning"); // +15 %
      expect(deltaTone(140, 100, { increaseIsGood: false })).toBe("critical"); // +40 % ≥ 25 %
    });
    it("sollte Rückgang bei Ausgaben als positiv einfärben", () => {
      expect(deltaTone(80, 100, { increaseIsGood: false })).toBe("positive");
    });
    it("sollte Rückgang beim Vermögen abgestuft warnen", () => {
      expect(deltaTone(90, 100, { increaseIsGood: true })).toBe("warning"); // −10 %
      expect(deltaTone(70, 100, { increaseIsGood: true })).toBe("critical"); // −30 %
    });
  });

  describe("deltaTone — konfigurierbare Schwellen", () => {
    it("sollte eine engere Totzone respektieren", () => {
      expect(deltaTone(102, 100, { neutralBand: 0.01 })).toBe("positive"); // +2 % > 1 %
    });
  });

  describe("deltaToneClass", () => {
    it("sollte Tokens-Klassen liefern", () => {
      expect(deltaToneClass("neutral")).toContain("muted-foreground");
      expect(deltaToneClass("positive")).toContain("positive");
      expect(deltaToneClass("critical")).toContain("destructive");
    });
  });
});
