import { describe, expect, it } from "vitest";
import { MAX_RECEIPT_TEXT_LENGTH, parseReceipt, receiptLowConfidenceFields } from "../receipt-parser-service";

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

  it("[SECURITY] rejects oversized OCR input before expensive parsing", () => {
    expect(() => parseReceipt("A".repeat(MAX_RECEIPT_TEXT_LENGTH + 1))).toThrow(/zu groß/);
  });

  it("[INTEGRITY] rejects impossible calendar dates", () => {
    const parsed = parseReceipt("Laden\nDatum 31.02.2026\nSumme 10,00");
    expect(parsed.date).toBeUndefined();
  });

  it("[SECURITY] strips control characters and limits merchant names", () => {
    const parsed = parseReceipt(`${"Shop".repeat(40)}\u0000<script>\nSumme 10,00`);
    expect(parsed.merchant?.value.length).toBeLessThanOrEqual(120);
    expect(parsed.merchant?.value).not.toContain("\u0000");
  });
});

describe("parseReceipt line items", () => {
  it("extracts product lines with quantity and unit price", () => {
    const text = [
      "REWE",
      "Apfel 2 x 1,99 3,98",
      "Brot 2,49",
      "SUMME EUR 6,47",
      "Bar 10,00",
      "Rückgeld 3,53",
    ].join("\n");

    const parsed = parseReceipt(text);
    expect(parsed.lineItems).toHaveLength(2);

    const [apfel, brot] = parsed.lineItems!;
    expect(apfel.name).toBe("Apfel");
    expect(apfel.quantity).toBe(2);
    expect(apfel.unitPrice).toBeCloseTo(1.99);
    expect(apfel.total).toBeCloseTo(3.98);
    expect(apfel.confidence).toBeGreaterThanOrEqual(0.75);

    expect(brot.name).toBe("Brot");
    expect(brot.quantity).toBeUndefined();
    expect(brot.total).toBeCloseTo(2.49);
  });

  it("excludes summary, tax and payment lines", () => {
    const text = [
      "Bäckerei Schmidt",
      "Brötchen 0,45",
      "Kaffee 2,80",
      "Netto 3,04",
      "MwSt 0,21",
      "Gesamt 3,25",
    ].join("\n");

    const parsed = parseReceipt(text);
    expect(parsed.lineItems).toHaveLength(2);
    expect(parsed.lineItems!.map((i) => i.name).sort()).toEqual(["Brötchen", "Kaffee"]);
  });

  it("returns no line items when nothing looks like a product (rather than guessing)", () => {
    const text = ["Kiosk", "SUMME 8,90", "MwSt 19% 1,42", "Gegeben 10,00", "Rückgeld 1,10"].join("\n");
    const parsed = parseReceipt(text);
    expect(parsed.lineItems).toBeUndefined();
  });
});
