import { describe, expect, it } from "vitest";
import { parseReceipt, receiptLowConfidenceFields } from "../receipt-parser-service";

describe("parseReceipt", () => {
  it("extracts merchant, total and date from a typical German receipt", () => {
    const text = [
      "EDEKA Müller",
      "Hauptstraße 1, 12345 Berlin",
      "Datum 05.06.2026  14:32",
      "Brot          2,49",
      "Milch         1,19",
      "SUMME EUR    12,34",
      "Bar          20,00",
      "Rückgeld      7,66",
    ].join("\n");

    const parsed = parseReceipt(text);
    expect(parsed.total?.value).toBeCloseTo(12.34);
    expect(parsed.date?.value).toBe("2026-06-05");
    expect(parsed.merchant?.value).toBe("EDEKA Müller");
  });

  it("prefers the labelled total over cash given / change", () => {
    const text = ["Kiosk", "Gesamt 8,90", "Gegeben 10,00", "Rückgeld 1,10"].join("\n");
    const parsed = parseReceipt(text);
    expect(parsed.total?.value).toBeCloseTo(8.9);
  });

  it("falls back to the largest plausible amount when no label is present", () => {
    const text = ["Laden", "Artikel A 3,00", "Artikel B 5,50"].join("\n");
    const parsed = parseReceipt(text);
    expect(parsed.total?.value).toBeCloseTo(5.5);
    expect(parsed.total?.confidence).toBeLessThan(0.7);
  });

  it("flags missing fields as low confidence", () => {
    const parsed = parseReceipt("nur irgendein text ohne zahlen");
    expect(receiptLowConfidenceFields(parsed)).toContain("total");
    expect(receiptLowConfidenceFields(parsed)).toContain("date");
  });
});
