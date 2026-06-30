import { describe, expect, it } from "vitest";
import { computeBufferShortfall } from "@/lib/liquidity-shortfall";

describe("computeBufferShortfall", () => {
  it("sollte keinen Bruch melden, wenn der Tiefststand über dem Puffer liegt", () => {
    const r = computeBufferShortfall({ lowestBalance: 1500, safetyBuffer: 1000, daysUntilTrough: 60 });
    expect(r.breaches).toBe(false);
    expect(r.deficit).toBe(0);
    expect(r.monthlyNeeded).toBe(0);
  });

  it("sollte den Fehlbetrag auf die Monate bis zum Tiefpunkt verteilen", () => {
    // 300 € Fehlbetrag, Tief in ~3 Monaten → 100 €/Monat.
    const r = computeBufferShortfall({ lowestBalance: 700, safetyBuffer: 1000, daysUntilTrough: 90 });
    expect(r.breaches).toBe(true);
    expect(r.deficit).toBe(300);
    expect(r.monthsUntilTrough).toBe(3);
    expect(r.monthlyNeeded).toBe(100);
  });

  it("sollte negativen Tiefststand (Dispo) korrekt als Fehlbetrag erfassen", () => {
    const r = computeBufferShortfall({ lowestBalance: -200, safetyBuffer: 0, daysUntilTrough: 30 });
    expect(r.deficit).toBe(200);
    expect(r.monthlyNeeded).toBe(200);
  });

  it("[Edge] sollte bei unmittelbarem Tiefpunkt mind. 1 Monat ansetzen", () => {
    const r = computeBufferShortfall({ lowestBalance: 500, safetyBuffer: 1000, daysUntilTrough: 0 });
    expect(r.monthsUntilTrough).toBe(1);
    expect(r.monthlyNeeded).toBe(500);
  });
});
