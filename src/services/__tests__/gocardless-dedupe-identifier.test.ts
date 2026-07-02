import { describe, it, expect } from "vitest";
import { buildTxIdentifier } from "../gocardless-sync-service";

/**
 * F-ARCH-2 / T1.6: Der Dedupe-Schlüssel muss identisch sein, egal ob er aus der
 * rohen API-Description (die der Sync kürzt) oder aus dem gespeicherten, bereits
 * gekürzten original_text gebaut wird. Sonst würden Buchungen mit langem
 * Verwendungszweck (> 200 Zeichen) bei jedem Sync erneut angelegt.
 */
describe("[REGRESSION] buildTxIdentifier ist slice-stabil (F-ARCH-2)", () => {
  it("liefert denselben Schlüssel für rohe und bereits gekürzte Description", () => {
    const longDescription = "SEPA-Sammler ".repeat(30); // > 200 Zeichen
    expect(longDescription.length).toBeGreaterThan(200);

    const stored = longDescription.slice(0, 200); // so wird original_text gespeichert
    const fromRaw = buildTxIdentifier("acc-1", "2026-01-15", -49.99, longDescription);
    const fromStored = buildTxIdentifier("acc-1", "2026-01-15", -49.99, stored);

    expect(fromRaw).toBe(fromStored);
  });

  it("unterscheidet verschiedene Buchungen anhand Konto, Datum, Betrag und Zweck", () => {
    const base = buildTxIdentifier("acc-1", "2026-01-15", -10, "Miete");
    expect(buildTxIdentifier("acc-2", "2026-01-15", -10, "Miete")).not.toBe(base);
    expect(buildTxIdentifier("acc-1", "2026-01-16", -10, "Miete")).not.toBe(base);
    expect(buildTxIdentifier("acc-1", "2026-01-15", -11, "Miete")).not.toBe(base);
    expect(buildTxIdentifier("acc-1", "2026-01-15", -10, "Strom")).not.toBe(base);
  });
});
