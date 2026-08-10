import { describe, it, expect } from "vitest";
import { typedKeys, recordToOptions } from "../typed-record";

/**
 * WP 5.3 (KOMP-5) — `Object.keys(record) as T[]` stand fünfmal in
 * `BudgetFormDialog` und zweimal in `DebtFormDialog`, jedes Mal als eigener
 * Cast an der Aufrufstelle. `typedKeys` zentralisiert den EINEN Cast, den
 * `Object.keys` unvermeidlich braucht (die Laufzeit kennt `T` nicht), in
 * genau einer Funktion — Aufrufstellen casten nicht mehr selbst.
 */
type Ampel = "rot" | "gelb" | "gruen";

describe("typedKeys", () => {
  it("sollte die Schlüssel eines Record<T, …> als T[] liefern", () => {
    const labels: Record<Ampel, string> = { rot: "Rot", gelb: "Gelb", gruen: "Grün" };
    const keys = typedKeys(labels);
    expect(keys.sort()).toEqual(["gelb", "gruen", "rot"]);
  });

  it("sollte ein leeres Record zu einem leeren Array machen", () => {
    expect(typedKeys({} as Record<Ampel, string>)).toEqual([]);
  });
});

describe("recordToOptions", () => {
  it("sollte aus einem Label-Record Options mit value+label bauen", () => {
    const labels: Record<Ampel, string> = { rot: "Rot", gelb: "Gelb", gruen: "Grün" };
    const options = recordToOptions(labels);
    expect(options).toHaveLength(3);
    expect(options).toContainEqual({ value: "rot", label: "Rot" });
    expect(options).toContainEqual({ value: "gruen", label: "Grün" });
  });
});
