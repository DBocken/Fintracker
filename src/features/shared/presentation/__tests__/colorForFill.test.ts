import { describe, it, expect } from "vitest";
import { colorForFill } from "../BudgetTank";

// Hilfsfunktion: grobe Farbzuordnung (welcher Kanal dominiert).
function dominant(rgb: string): "blue" | "amber" | "red" {
  const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
  if (b > r) return "blue";
  if (r > 150 && g > 120) return "amber";
  return "red";
}

describe("colorForFill", () => {
  describe("Farbumschlag an den Schwellen", () => {
    it("sollte deutlich unter der Warnschwelle blau sein", () => {
      expect(dominant(colorForFill(30, 80, false).top)).toBe("blue");
    });

    it("sollte deutlich über der Warnschwelle bernstein sein", () => {
      expect(dominant(colorForFill(95, 80, false).top)).toBe("amber");
    });

    it("sollte bei Überziehung nahe der Vollmarke rot werden", () => {
      expect(dominant(colorForFill(100, 80, true).top)).toBe("red");
    });

    it("sollte ohne Überziehung auch bei 100% nicht rot werden", () => {
      expect(dominant(colorForFill(100, 80, false).top)).toBe("amber");
    });
  });

  describe("Regression", () => {
    it("[REGRESSION] sollte bei over=true und niedrigem Füllstand NICHT schwarz werden", () => {
      // Bug: rgb()-Strings wurden erneut als Hex geparst → rgb(0,0,0).
      for (const f of [12, 45, 72, 86]) {
        const c = colorForFill(f, 80, true);
        const [r, g, b] = c.top.match(/\d+/g)!.map(Number);
        expect(r + g + b, `Füllstand ${f}% war schwarz`).toBeGreaterThan(60);
      }
    });

    it("[REGRESSION] sollte bei over=true unter der Warnschwelle blau bleiben", () => {
      expect(dominant(colorForFill(45, 80, true).top)).toBe("blue");
    });
  });

  describe("Weiche Interpolation", () => {
    it("sollte genau an der Warnschwelle zwischen Blau und Bernstein liegen (Mischfarbe)", () => {
      const atWarn = colorForFill(80, 80, false).top;
      const below = colorForFill(30, 80, false).top;
      const above = colorForFill(99, 80, false).top;
      // Mischwert unterscheidet sich von beiden Reinzuständen.
      expect(atWarn).not.toBe(below);
      expect(atWarn).not.toBe(above);
    });

    it("sollte mit steigendem Füllstand 'wärmer' werden (Blauanteil sinkt blau→bernstein)", () => {
      const blueAt = (f: number) => Number(colorForFill(f, 80, false).top.match(/\d+/g)![2]);
      // Blau-Kanal: OK ~248 → WARN ~36, also fällt er über die Warnschwelle.
      expect(blueAt(30)).toBeGreaterThan(blueAt(80));
      expect(blueAt(80)).toBeGreaterThan(blueAt(99));
    });
  });
});
