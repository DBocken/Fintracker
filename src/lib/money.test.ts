import { describe, it, expect } from "vitest";
import { toMinor, toMajor, sumMinor } from "./money";

describe("money", () => {
  it("konvertiert 2-Dezimal-Euro exakt in Cent", () => {
    expect(toMinor(12.5)).toBe(1250);
    expect(toMinor(19.99)).toBe(1999);
    expect(toMinor(5.1)).toBe(510);
    expect(toMinor(0)).toBe(0);
  });

  it("behandelt Float-Drift korrekt", () => {
    expect(toMinor(0.1 + 0.2)).toBe(30);
  });

  it("erhält das Vorzeichen", () => {
    expect(toMinor(-9.99)).toBe(-999);
    expect(toMinor(-0.01)).toBe(-1);
  });

  it("round-trip toMajor(toMinor(x)) ist verlustfrei für 2 Dezimalstellen", () => {
    for (const x of [0, 1.23, -4.56, 1000.99, -0.07]) {
      expect(toMajor(toMinor(x))).toBeCloseTo(x, 2);
    }
  });

  it("summiert Cent-Listen als Integer", () => {
    expect(sumMinor([333, 333, 334])).toBe(1000);
    expect(sumMinor([])).toBe(0);
  });
});
