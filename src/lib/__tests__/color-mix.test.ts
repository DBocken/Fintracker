import { describe, it, expect } from "vitest";
import { clamp01, smoothstep, hexToRgb, lerpRgb, rgbStr } from "../color-mix";

describe("color-mix", () => {
  describe("clamp01", () => {
    it("sollte Werte innerhalb [0,1] unverändert lassen", () => {
      expect(clamp01(0.3)).toBe(0.3);
    });

    it("sollte unterhalb 0 auf 0 und oberhalb 1 auf 1 kappen", () => {
      expect(clamp01(-2)).toBe(0);
      expect(clamp01(5)).toBe(1);
    });
  });

  describe("smoothstep", () => {
    it("sollte unterhalb edge0 = 0 und oberhalb edge1 = 1 liefern", () => {
      expect(smoothstep(10, 20, 5)).toBe(0);
      expect(smoothstep(10, 20, 25)).toBe(1);
    });

    it("sollte am Mittelpunkt 0.5 liefern (symmetrische Rampe)", () => {
      expect(smoothstep(0, 10, 5)).toBeCloseTo(0.5, 5);
    });

    it("sollte bei identischen Kanten als harte Stufe wirken", () => {
      expect(smoothstep(10, 10, 9)).toBe(0);
      expect(smoothstep(10, 10, 10)).toBe(1);
    });
  });

  describe("hexToRgb / rgbStr", () => {
    it("sollte Hex korrekt in RGB-Tupel zerlegen", () => {
      expect(hexToRgb("#38bdf8")).toEqual([56, 189, 248]);
    });

    it("sollte ein Tupel als CSS-rgb()-String formatieren", () => {
      expect(rgbStr([56, 189, 248])).toBe("rgb(56, 189, 248)");
    });
  });

  describe("lerpRgb", () => {
    it("sollte bei t=0 die Startfarbe und bei t=1 die Zielfarbe liefern", () => {
      const a: [number, number, number] = [0, 0, 0];
      const b: [number, number, number] = [100, 200, 50];
      expect(lerpRgb(a, b, 0)).toEqual([0, 0, 0]);
      expect(lerpRgb(a, b, 1)).toEqual([100, 200, 50]);
    });

    it("sollte am Mittelpunkt ganzzahlig runden", () => {
      expect(lerpRgb([0, 0, 0], [10, 11, 12], 0.5)).toEqual([5, 6, 6]);
    });
  });

  // Sichert ab, dass die Extraktion aus BudgetTank die Tank-Farben nicht
  // verschoben hat: colorForFill konsumiert genau diese Primitive.
  describe("Regression Protection", () => {
    it("[REGRESSION] sollte für die Tank-Palette stabile Stützwerte liefern", () => {
      expect(hexToRgb("#f87171")).toEqual([248, 113, 113]); // over.top
      expect(hexToRgb("#0369a1")).toEqual([3, 105, 161]); // ok.bottom
      // Blend ok.top → warn.top bei halber Rampe (deterministisch).
      expect(lerpRgb(hexToRgb("#38bdf8"), hexToRgb("#fbbf24"), 0.5)).toEqual([
        Math.round((56 + 251) / 2),
        Math.round((189 + 191) / 2),
        Math.round((248 + 36) / 2),
      ]);
    });
  });
});
