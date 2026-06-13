import { describe, expect, it } from "vitest";
import { mapCycleToRhythmus } from "../contract-types";

describe("mapCycleToRhythmus", () => {
  it("maps known cycles to their Rhythmus equivalent", () => {
    expect(mapCycleToRhythmus("Wöchentlich")).toBe("weekly");
    expect(mapCycleToRhythmus("Monatlich")).toBe("monthly");
    expect(mapCycleToRhythmus("Vierteljährlich")).toBe("quarterly");
    expect(mapCycleToRhythmus("Jährlich")).toBe("yearly");
  });

  it("returns null for cycles without a Rhythmus equivalent", () => {
    expect(mapCycleToRhythmus("Halbjährlich")).toBeNull();
    expect(mapCycleToRhythmus("Unbekannt")).toBeNull();
  });
});
