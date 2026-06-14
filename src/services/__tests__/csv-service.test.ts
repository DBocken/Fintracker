import { describe, expect, it } from "vitest";
import { createDefaultMapping, detectBank, parseCsv, BANK_TEMPLATES } from "../csv-service";

const SPARKASSE_HEADERS = [
  "Auftragskonto",
  "Buchungstag",
  "Valutadatum",
  "Buchungstext",
  "Verwendungszweck",
  "Beguenstigter/Zahlungspflichtiger",
  "Kontonummer/IBAN",
  "BIC (SWIFT-Code)",
  "Betrag",
  "Waehrung",
  "Info",
  "Kategorie",
];

describe("detectBank", () => {
  it("detects Sparkasse exports by their full header set", () => {
    expect(detectBank(SPARKASSE_HEADERS)).toBe("sparkasse");
  });

  it("detects N26 exports via the 'Amount (EUR)' column", () => {
    expect(detectBank(["Date", "Payee", "Amount (EUR)", "Currency"])).toBe("n26");
  });

  it("detects DKB exports via the Beguenstigter column without the full Sparkasse set", () => {
    expect(detectBank(["Buchungstag", "Beguenstigter/Zahlungspflichtiger", "Betrag"])).toBe("dkb");
  });

  it("returns undefined for unknown header sets", () => {
    expect(detectBank(["Foo", "Bar", "Baz"])).toBeUndefined();
  });
});

describe("createDefaultMapping", () => {
  it("maps the first four columns to date/amount/payee/description", () => {
    const headers = ["Datum", "Betrag", "Empfaenger", "Verwendungszweck", "Waehrung", "Kategorie"];
    const mapping = createDefaultMapping(headers);

    expect(mapping).toMatchObject({
      bankName: "custom",
      dateColumn: "Datum",
      amountColumn: "Betrag",
      payeeColumn: "Empfaenger",
      descriptionColumn: "Verwendungszweck",
      currencyColumn: "Waehrung",
      categoryColumn: "Kategorie",
    });
  });

  it("falls back to the first column after index 4 when no category-like header exists", () => {
    const headers = ["Datum", "Betrag", "Empfaenger", "Verwendungszweck", "Waehrung", "Sonstiges"];
    const mapping = createDefaultMapping(headers);
    expect(mapping.categoryColumn).toBe("Sonstiges");
  });
});

function makeCsvFile(content: string): File {
  return new File([content], "transactions.csv", { type: "text/csv" });
}

describe("parseCsv", () => {
  it("parses German decimal commas and DD.MM.YYYY dates", async () => {
    const csv = [
      "Buchungstag;Betrag;Beguenstigter/Zahlungspflichtiger;Verwendungszweck;Waehrung",
      "15.01.2024;-125,50;REWE Markt;Wocheneinkauf;EUR",
    ].join("\n");

    const [tx] = await parseCsv(makeCsvFile(csv), BANK_TEMPLATES.sparkasse, ";");

    expect(tx.date).toBe("2024-01-15");
    expect(tx.amount).toBeCloseTo(-125.5);
    expect(tx.payee).toBe("REWE Markt");
    expect(tx.description).toBe("Wocheneinkauf");
    expect(tx.currency).toBe("EUR");
  });

  it("preserves umlauts in payee and description", async () => {
    const csv = [
      "Buchungstag;Betrag;Beguenstigter/Zahlungspflichtiger;Verwendungszweck;Waehrung",
      "01.02.2024;-9,99;Bäckerei Müller;Brötchen für Frühstück;EUR",
    ].join("\n");

    const [tx] = await parseCsv(makeCsvFile(csv), BANK_TEMPLATES.sparkasse, ";");

    expect(tx.payee).toBe("Bäckerei Müller");
    expect(tx.description).toBe("Brötchen für Frühstück");
  });

  it("parses positive amounts with a leading plus sign", async () => {
    const csv = [
      "Buchungstag;Betrag;Beguenstigter/Zahlungspflichtiger;Verwendungszweck;Waehrung",
      "02.02.2024;+1234,56;Arbeitgeber GmbH;Gehalt;EUR",
    ].join("\n");

    const [tx] = await parseCsv(makeCsvFile(csv), BANK_TEMPLATES.sparkasse, ";");

    expect(tx.amount).toBeCloseTo(1234.56);
  });

  it("strips thousands separators ('.') before applying the decimal comma", async () => {
    const csv = [
      "Buchungstag;Betrag;Beguenstigter/Zahlungspflichtiger;Verwendungszweck;Waehrung",
      "02.02.2024;+1.234,56;Arbeitgeber GmbH;Gehalt;EUR",
    ].join("\n");

    const [tx] = await parseCsv(makeCsvFile(csv), BANK_TEMPLATES.sparkasse, ";");

    expect(tx.amount).toBeCloseTo(1234.56);
  });

  it("falls back to 0 for missing/unparseable amounts", async () => {
    const csv = [
      "Buchungstag;Betrag;Beguenstigter/Zahlungspflichtiger;Verwendungszweck;Waehrung",
      "03.02.2024;;Unbekannt;Test;EUR",
    ].join("\n");

    const [tx] = await parseCsv(makeCsvFile(csv), BANK_TEMPLATES.sparkasse, ";");
    expect(tx.amount).toBe(0);
  });

  it("skips empty lines", async () => {
    const csv = [
      "Buchungstag;Betrag;Beguenstigter/Zahlungspflichtiger;Verwendungszweck;Waehrung",
      "01.01.2024;-1,00;A;Test A;EUR",
      "",
      "02.01.2024;-2,00;B;Test B;EUR",
    ].join("\n");

    const result = await parseCsv(makeCsvFile(csv), BANK_TEMPLATES.sparkasse, ";");
    expect(result).toHaveLength(2);
  });
});
