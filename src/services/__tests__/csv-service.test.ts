import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createDefaultMapping, detectBank, parseCsv, BANK_TEMPLATES } from "../csv-service";

beforeEach(() => {
  localStorage.setItem("ausgabentracker_locale_v1", "de");
});

afterEach(() => {
  localStorage.removeItem("ausgabentracker_locale_v1");
});

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
  it("[INTEGRITY] erzeugt bei erneutem Parsen derselben Datei stabile IDs", async () => {
    const csv = [
      "Buchungstag;Betrag;Beguenstigter/Zahlungspflichtiger;Verwendungszweck;Waehrung",
      "15.01.2024;-125,50;REWE Markt;Wocheneinkauf;EUR",
    ].join("\n");

    const first = await parseCsv(makeCsvFile(csv), BANK_TEMPLATES.sparkasse, ";");
    const second = await parseCsv(makeCsvFile(csv), BANK_TEMPLATES.sparkasse, ";");

    expect(first[0].id).toMatch(/^csv-[a-f0-9]{32}$/);
    expect(second[0].id).toBe(first[0].id);
  });

  it("[INTEGRITY] sollte für dieselbe Buchung in zwei überlappenden Exporten dieselbe ID erzeugen", async () => {
    // Der Kern von F3a: Die ID enthielt den ZEILENINDEX. Dieselbe Buchung
    // stand im Februar-Export an anderer Stelle als im Januar-Export und
    // wurde deshalb ein zweites Mal angelegt — ab da zählte jede Summe sie
    // doppelt, ohne Fehlermeldung.
    const kopf = "Buchungstag;Betrag;Beguenstigter/Zahlungspflichtiger;Verwendungszweck;Waehrung";
    const gemeinsam = "15.02.2024;-49,99;NETFLIX;Abo;EUR";

    const januarBisMaerz = [kopf, "15.01.2024;-10,00;BAECKER;Broetchen;EUR", gemeinsam].join("\n");
    const februarBisApril = [kopf, gemeinsam, "15.03.2024;-20,00;ALDI;Einkauf;EUR"].join("\n");

    const ersterExport = await parseCsv(makeCsvFile(januarBisMaerz), BANK_TEMPLATES.sparkasse, ";");
    const zweiterExport = await parseCsv(makeCsvFile(februarBisApril), BANK_TEMPLATES.sparkasse, ";");

    const netflixZuerst = ersterExport.find((tx) => tx.payee === "NETFLIX")!;
    const netflixDanach = zweiterExport.find((tx) => tx.payee === "NETFLIX")!;
    expect(netflixDanach.id).toBe(netflixZuerst.id);
  });

  it("[INTEGRITY] sollte zwei inhaltlich identische Zeilen derselben Datei unterschiedlich identifizieren", async () => {
    // Die Gegenrichtung: Eine Bank darf am selben Tag zweimal denselben Betrag
    // beim selben Händler buchen. Zwei echte Buchungen zu einer zu machen wäre
    // genauso falsch wie eine zu zwei.
    const csv = [
      "Buchungstag;Betrag;Beguenstigter/Zahlungspflichtiger;Verwendungszweck;Waehrung",
      "15.01.2024;-3,50;BAECKER;Broetchen;EUR",
      "15.01.2024;-3,50;BAECKER;Broetchen;EUR",
    ].join("\n");

    const zeilen = await parseCsv(makeCsvFile(csv), BANK_TEMPLATES.sparkasse, ";");

    expect(zeilen).toHaveLength(2);
    expect(zeilen[0].id).not.toBe(zeilen[1].id);
  });

  it("[INTEGRITY] sollte die ID nicht von der Zeilenposition abhängig machen", async () => {
    const kopf = "Buchungstag;Betrag;Beguenstigter/Zahlungspflichtiger;Verwendungszweck;Waehrung";
    const zeile = "15.01.2024;-125,50;REWE Markt;Wocheneinkauf;EUR";

    const alleine = await parseCsv(makeCsvFile([kopf, zeile].join("\n")), BANK_TEMPLATES.sparkasse, ";");
    const mitVorspann = await parseCsv(
      makeCsvFile([kopf, "01.01.2024;-1,00;ANDERE;Zeile;EUR", zeile].join("\n")),
      BANK_TEMPLATES.sparkasse,
      ";",
    );

    expect(mitVorspann[1].id).toBe(alleine[0].id);
  });

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

  it("[SECURITY] rejects missing/unparseable amounts instead of silently importing zero", async () => {
    const csv = [
      "Buchungstag;Betrag;Beguenstigter/Zahlungspflichtiger;Verwendungszweck;Waehrung",
      "03.02.2024;;Unbekannt;Test;EUR",
    ].join("\n");

    await expect(parseCsv(makeCsvFile(csv), BANK_TEMPLATES.sparkasse, ";")).rejects.toThrow(/Ungültiger Betrag/);
  });

  it("[SECURITY] rejects impossible dates instead of normalizing them", async () => {
    const csv = [
      "Buchungstag;Betrag;Beguenstigter/Zahlungspflichtiger;Verwendungszweck;Waehrung",
      "31.02.2024;-1,00;Unbekannt;Test;EUR",
    ].join("\n");
    await expect(parseCsv(makeCsvFile(csv), BANK_TEMPLATES.sparkasse, ";")).rejects.toThrow(/Ungültiges Buchungsdatum/);
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
