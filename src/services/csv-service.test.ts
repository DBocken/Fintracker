import { describe, it, expect } from "vitest";
import { detectBank, createDefaultMapping, parseCsv, BANK_TEMPLATES } from "./csv-service";

function csvFile(content: string): File {
  return new File([content], "test.csv", { type: "text/csv" });
}

describe("detectBank", () => {
  it("erkennt N26 an der Amount-(EUR)-Spalte", () => {
    expect(detectBank(["Date", "Payee", "Amount (EUR)", "Currency"])).toBe("n26");
  });

  it("erkennt DKB an der Begünstigten-Spalte", () => {
    expect(detectBank(["Buchungstag", "Beguenstigter/Zahlungspflichtiger", "Betrag"])).toBe("dkb");
  });

  it("erkennt Sparkasse am vollständigen Spaltensatz", () => {
    const headers = [
      "Auftragskonto",
      "Buchungstag",
      "Valutadatum",
      "Verwendungszweck",
      "Beguenstigter/Zahlungspflichtiger",
      "Betrag",
      "Waehrung",
      "Kategorie",
    ];
    expect(detectBank(headers)).toBe("sparkasse");
  });

  it("gibt undefined für unbekannte Header zurück", () => {
    expect(detectBank(["foo", "bar"])).toBeUndefined();
  });
});

describe("createDefaultMapping", () => {
  it("findet die Kategorie-Spalte unabhängig von der Position", () => {
    const mapping = createDefaultMapping(["Datum", "Betrag", "Empfänger", "Zweck", "Währung", "Kategorie"]);
    expect(mapping.categoryColumn).toBe("Kategorie");
  });
});

describe("parseCsv", () => {
  it("parst deutsche Beträge mit Komma auf Cent-Genauigkeit", async () => {
    const csv = [
      "Date;Payee;Amount (EUR);Currency",
      "2024-01-15;REWE;-12,99;EUR",
      "2024-01-16;Gehalt;2.500,00;EUR",
    ].join("\n");
    const rows = await parseCsv(csvFile(csv), BANK_TEMPLATES.n26, ";");
    expect(rows).toHaveLength(2);
    expect(rows[0].amount).toBeCloseTo(-12.99, 2);
    expect(rows[0].payee).toBe("REWE");
    expect(rows[0].currency).toBe("EUR");
    expect(rows[1].amount).toBeCloseTo(2500, 2);
  });

  it("normalisiert deutsche Datumsformate nach ISO", async () => {
    const csv = ["Buchungstag;Beguenstigter/Zahlungspflichtiger;Betrag;Verwendungszweck", "15.01.2024;REWE;-9,50;Einkauf"].join("\n");
    const rows = await parseCsv(csvFile(csv), BANK_TEMPLATES.sparkasse, ";");
    expect(rows[0].date).toBe("2024-01-15");
  });

  it("behandelt Umlaute im Verwendungszweck korrekt", async () => {
    const csv = ["Date;Payee;Amount (EUR);Currency", "2024-02-01;Bäckerei Müller;-3,40;EUR"].join("\n");
    const rows = await parseCsv(csvFile(csv), BANK_TEMPLATES.n26, ";");
    expect(rows[0].payee).toBe("Bäckerei Müller");
  });

  it("überspringt leere Zeilen und liefert sichere Defaults für fehlende Felder", async () => {
    const csv = ["Date;Payee;Amount (EUR);Currency", "2024-03-01;;;", "", "2024-03-02;Shop;-1,00;EUR"].join("\n");
    const rows = await parseCsv(csvFile(csv), BANK_TEMPLATES.n26, ";");
    expect(rows).toHaveLength(2);
    expect(rows[0].amount).toBe(0);
    expect(rows[0].payee).toBe("");
    expect(rows[0].currency).toBe("EUR");
  });
});
