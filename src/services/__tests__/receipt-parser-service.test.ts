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
    expect(() => parseReceipt("A".repeat(MAX_RECEIPT_TEXT_LENGTH + 1))).toThrow(/zu groß|too large/);
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

describe("parseReceipt Summenkonsistenz", () => {
  /**
   * Die Prüfung, die bis hierher fehlte: Zeilenbeträge und Gesamtbetrag wurden
   * nebeneinander erkannt und nie gegeneinander gehalten. Je Zeile gab es
   * bereits eine Prüfung (Menge × Stückpreis ≈ Zeilenbetrag) — über den Beleg
   * hinweg keine.
   *
   * Die Richtung des Widerspruchs entscheidet, und zwar streng:
   * Eine Zeilensumme UNTER dem Gesamtbetrag ist der Normalfall, weil die
   * Zeilenerkennung bewusst konservativ ist und Zeilen auslässt. Nur eine
   * Zeilensumme ÜBER dem Gesamtbetrag ist ein echter Widerspruch — dann ist
   * entweder ein Betrag zu hoch gelesen oder eine Nicht-Produktzeile
   * mitgezählt worden.
   */
  it("sollte den Gesamtbetrag bestätigen, wenn die Zeilen ihn genau ergeben", () => {
    const text = ["REWE", "Apfel 2 x 1,99 3,98", "Brot 2,49", "SUMME EUR 6,47"].join("\n");

    const parsed = parseReceipt(text);
    expect(parsed.totalCheck).toBe("confirmed");
    expect(parsed.lineItemSum).toBeCloseTo(6.47);
    expect(parsed.total!.confidence).toBeGreaterThan(0.9);
  });

  it("sollte einen Widerspruch melden, wenn die Zeilen MEHR ergeben als die Summe", () => {
    // 3,98 + 2,49 = 6,47, der Beleg behauptet 4,47 — einer der beiden Werte
    // ist falsch gelesen, und welcher, weiß niemand.
    const text = ["REWE", "Apfel 2 x 1,99 3,98", "Brot 2,49", "SUMME EUR 4,47"].join("\n");

    const parsed = parseReceipt(text);
    expect(parsed.totalCheck).toBe("exceeds");
    expect(receiptLowConfidenceFields(parsed)).toContain("total");
  });

  it("sollte eine unvollständige Zeilenerkennung NICHT als Fehler werten", () => {
    // Nur eine von mehreren Produktzeilen erkannt: erwartbar, kein Widerspruch.
    // Diese Zeilen unter Verdacht zu stellen hiesse, bei fast jedem Beleg zu
    // warnen — und eine Warnung, die immer kommt, wird nicht mehr gelesen.
    const text = ["REWE", "Brot 2,49", "SUMME EUR 18,90"].join("\n");

    const parsed = parseReceipt(text);
    expect(parsed.totalCheck).toBe("incomplete");
    expect(receiptLowConfidenceFields(parsed)).not.toContain("total");
  });

  it("sollte ohne Zeilen oder ohne Summe kein Urteil fällen", () => {
    const ohneZeilen = parseReceipt(["Kiosk", "SUMME 8,90", "Rückgeld 1,10"].join("\n"));
    expect(ohneZeilen.totalCheck).toBe("unknown");

    const ohneSumme = parseReceipt(["Kiosk"].join("\n"));
    expect(ohneSumme.totalCheck).toBe("unknown");
  });

  it("sollte Rundungsdifferenzen im Centbereich tolerieren", () => {
    // Dieselbe Toleranz wie die Zeilenprüfung (< 0,02) — sonst würde ein
    // gerundeter Stückpreis den Beleg grundlos verdächtig machen.
    const text = ["REWE", "Apfel 3 x 0,33 0,99", "Brot 2,49", "SUMME EUR 3,49"].join("\n");

    const parsed = parseReceipt(text);
    expect(parsed.totalCheck).toBe("confirmed");
  });
});
