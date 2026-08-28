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

describe("parseReceipt Selbstkorrektur über die Summenprüfung", () => {
  /**
   * Nachgemessen an realistischen Bons: Ein `exceeds` entsteht nicht durch eine
   * falsch gelesene Ziffer, sondern durch EINE Zeile zu viel — Pfand, Rabatt
   * oder eine unbenannte Zwischensumme, die die Ausschlussliste nicht kennt.
   * In allen drei Gegenproben stellte das Entfernen genau einer Zeile die
   * Übereinstimmung her.
   *
   * Deshalb wird hier keine Ziffernverwechslung geraten. Der Verifizierer ist
   * die Summe selbst: Eine Korrektur zählt nur, wenn sie den Widerspruch
   * auflöst — und nur, wenn sie die EINZIGE ist, die das tut.
   */
  it("sollte eine überzählige Zeile entfernen, wenn genau das die Summe aufgehen lässt", () => {
    const text = ["REWE", "Apfel 2 x 1,99 3,98", "Brot 2,49", "Pfand 0,25", "SUMME EUR 6,47"].join("\n");

    const parsed = parseReceipt(text);
    expect(parsed.totalCheck).toBe("confirmed");
    expect(parsed.discardedLine?.name).toBe("Pfand");
    expect(parsed.lineItems!.map((i) => i.name)).toEqual(["Apfel", "Brot"]);
    expect(parsed.lineItemSum).toBeCloseTo(6.47);
  });

  it("sollte eine als Posten missdeutete Zwischensumme entfernen", () => {
    const text = ["DM", "Shampoo 3,95", "Zahnpasta 1,95", "Kundenkarte 5,90", "SUMME EUR 5,90"].join("\n");

    const parsed = parseReceipt(text);
    expect(parsed.totalCheck).toBe("confirmed");
    expect(parsed.discardedLine?.total).toBeCloseTo(5.9);
  });

  it("sollte NICHT korrigieren, wenn zwei verschiedene Zeilen es gleichermaßen täten", () => {
    // Zwei Zeilen über 1,00: Beide Entfernungen lassen die Summe aufgehen, und
    // welche der beiden die falsche ist, weiß hier niemand. Dieselbe Regel wie
    // bei der Kategorie-Auflösung: Mehrdeutigkeit ⇒ kein Ergebnis, nicht das
    // erstbeste.
    const text = ["Kiosk", "Wasser 1,00", "Kaugummi 1,00", "Zeitung 2,50", "SUMME EUR 3,50"].join("\n");

    const parsed = parseReceipt(text);
    expect(parsed.totalCheck).toBe("exceeds");
    expect(parsed.discardedLine).toBeUndefined();
  });

  it("sollte NICHT korrigieren, wenn keine einzelne Zeile den Widerspruch erklärt", () => {
    // Differenz 3,00, aber keine Zeile trägt 3,00. Dann ist die Ursache eine
    // andere — vielleicht ein falsch gelesener Betrag — und ein Entfernen wäre
    // Kosmetik an der falschen Stelle.
    const text = ["Kiosk", "Wasser 1,10", "Kaugummi 1,20", "Zeitung 2,50", "SUMME EUR 1,80"].join("\n");

    const parsed = parseReceipt(text);
    expect(parsed.totalCheck).toBe("exceeds");
    expect(parsed.discardedLine).toBeUndefined();
  });

  it("[REGRESSION] sollte einen GERATENEN Gesamtbetrag nicht durch die Zeilen bestätigen lassen", () => {
    // Ohne Summenzeile fällt `extractTotal` auf den größten Betrag des Belegs
    // zurück — und der ist selbst eine der Produktzeilen. Die Prüfung würde
    // dann nur noch sich selbst bestätigen und dafür die übrigen Posten
    // entfernen, bis die Rechnung aufgeht. Genau das tat sie beim ersten
    // Entwurf: Aus „Artikel A 3,00 / Artikel B 5,50" wurde ein bestätigter
    // Beleg über 5,50 mit weggeworfenem Artikel A.
    const text = ["Laden", "Artikel A 3,00", "Artikel B 5,50"].join("\n");

    const parsed = parseReceipt(text);
    expect(parsed.totalCheck).toBe("unknown");
    expect(parsed.discardedLine).toBeUndefined();
    expect(parsed.lineItems).toHaveLength(2);
    expect(parsed.total!.confidence).toBeLessThan(0.7);
  });

  it("sollte die Confidence nach einer Korrektur unter die einer echten Bestätigung setzen", () => {
    // Eine hergeleitete Übereinstimmung ist schwächer als eine gefundene: Die
    // Zeilen wurden passend gemacht, nicht unabhängig bestätigt.
    const repariert = parseReceipt(
      ["REWE", "Apfel 2 x 1,99 3,98", "Brot 2,49", "Pfand 0,25", "SUMME EUR 6,47"].join("\n"),
    );
    const echt = parseReceipt(["REWE", "Apfel 2 x 1,99 3,98", "Brot 2,49", "SUMME EUR 6,47"].join("\n"));

    expect(repariert.total!.confidence).toBeLessThan(echt.total!.confidence);
    expect(repariert.total!.confidence).toBeGreaterThan(0.7);
  });
});
