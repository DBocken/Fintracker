import { describe, it, expect } from "vitest";
import { sumMinor, toMinor } from "../money";

/**
 * Demonstrations-Testdatei für WP 5.1 (DOM-1, docs/qualitaet-2026-08/plan.md).
 *
 * Ziel: eine Cent-Euro-Verwechslung soll ein Compile-Fehler sein, nicht nur
 * ein Laufzeit-Bug. `sumMinor` erwartet seit dem Brand `Cents[]`, nicht
 * `number[]` — ein roher Euro-Float (oder irgendein unbranded `number`) darf
 * NICHT durchgereicht werden.
 *
 * Diese Datei ist selbsttragend: Ein `@ts-expect-error`, das nicht greift,
 * macht `tsc --noEmit` rot ("Unused '@ts-expect-error' directive"). Vor dem
 * Brand (money.ts: `sumMinor(values: number[])`) greift die Zeile NICHT,
 * weil `euroWert` (ein normaler `number`) klaglos durchgeht — das ist der
 * dokumentierte rote Zustand.
 */
describe("Cents-Brand (WP 5.1, DOM-1)", () => {
  it("sollte einen rohen Euro-Float NICHT als Cent-Liste durchlassen (Compile-Zeit)", () => {
    const euroWert = 12.5;
    // @ts-expect-error — euroWert ist ein roher Euro-Float (number), kein Cents-Wert.
    // Ohne Brand kompiliert dieser Aufruf klaglos und die Verwechslung bliebe
    // bis zur Laufzeit unsichtbar (genau der DOM-1-Befund).
    sumMinor([euroWert]);
    expect(true).toBe(true);
  });

  it("sollte einen echten Cents-Wert (aus toMinor) anstandslos summieren", () => {
    expect(sumMinor([toMinor(12.5), toMinor(0.5)])).toBe(1300);
  });
});
