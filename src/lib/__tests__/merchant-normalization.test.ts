import { describe, expect, it } from "vitest";
import { normalizeMerchantName } from "../merchant-normalization";

describe("normalizeMerchantName", () => {
  it("returns empty string for null/undefined/empty input", () => {
    expect(normalizeMerchantName(null)).toBe("");
    expect(normalizeMerchantName(undefined)).toBe("");
    expect(normalizeMerchantName("")).toBe("");
  });

  it("lowercases the input", () => {
    expect(normalizeMerchantName("REWE")).toBe("rewe");
  });

  it("strips legal suffixes", () => {
    expect(normalizeMerchantName("REWE Markt GmbH")).toBe("rewe markt");
    expect(normalizeMerchantName("Beispiel AG")).toBe("beispiel");
    expect(normalizeMerchantName("Muster GmbH & Co. KG")).toBe("muster");
  });

  it("strips payment processor / reference noise", () => {
    expect(normalizeMerchantName("Kartenzahlung REWE SAGT DANKE")).toBe("rewe sagt danke");
    expect(normalizeMerchantName("SEPA Lastschrift Netflix")).toBe("netflix");
  });

  it("strips reference numbers, store numbers and dates", () => {
    // Bis zur Ortszusatz-Behebung erwartete dieser Test „rewe sagt danke de
    // muenchen" — und pinnte damit genau den Fehler fest, den er zu prüfen
    // schien: Dieselbe Kette in zwei Städten ergab zwei Händlerfamilien. Die
    // Erwartung ist bewusst geändert, der Grund steht im [REGRESSION]-Test
    // „sollte dieselbe Filiale in zwei Städten als EINEN Händler führen".
    expect(normalizeMerchantName("PAYMENT 847261 REWE SAGT DANKE 3847 DE//MUENCHEN/2024-01-05")).toBe(
      "rewe sagt danke"
    );
  });

  it("collapses whitespace", () => {
    expect(normalizeMerchantName("  Aldi   Sued  ")).toBe("aldi sued");
  });
});

/**
 * Händlerfamilie über Ortszusatz, TLD und Rechtsform hinweg.
 *
 * Gemessen an realistischen Empfängerstrings zerfiel VORHER jede dieser
 * Gruppen in zwei bis drei Familien — obwohl es je ein Händler ist. Am
 * teuersten war der Ortszusatz: Er entsteht bei jeder Kartenzahlung, und er
 * machte aus „REWE in München" und „REWE in Berlin" zwei Vertragsfamilien,
 * zwei Fingerprints und zwei getrennte Auswertungen.
 *
 * Der Schnitt ist bewusst STRUKTURELL, nicht über eine Städteliste: Banken
 * setzen Ort und Datum hinter einen doppelten Schrägstrich. Eine Wortliste
 * deutscher Städte wäre nie vollständig und würde echte Händlernamen
 * verstümmeln („Frankfurter Allgemeine").
 */
describe("normalizeMerchantName — eine Familie je Händler", () => {
  const familie = (...schreibweisen: string[]) =>
    new Set(schreibweisen.map((s) => normalizeMerchantName(s)));

  it("[REGRESSION] sollte den Ortszusatz hinter // abschneiden", () => {
    expect(normalizeMerchantName("REWE SAGT DANKE 3847 DE//MUENCHEN/2024-01-05")).toBe("rewe sagt danke");
    expect(normalizeMerchantName("ALDI SUED SAGT DANKE//KOELN/DE")).toBe("aldi sued sagt danke");
  });

  it("[REGRESSION] sollte dieselbe Filiale in zwei Städten als EINEN Händler führen", () => {
    expect(
      familie(
        "REWE SAGT DANKE 3847 DE//MUENCHEN/2024-01-05",
        "REWE SAGT DANKE 1122 DE//BERLIN/2024-02-03",
        "REWE SAGT DANKE",
      ).size,
    ).toBe(1);
  });

  it("[REGRESSION] sollte eine Top-Level-Domain abschneiden", () => {
    expect(normalizeMerchantName("NETFLIX.COM")).toBe("netflix");
    expect(normalizeMerchantName("Spotify.com")).toBe("spotify");
    expect(normalizeMerchantName("AMAZON.DE")).toBe("amazon");
  });

  it("sollte weitere Rechtsformen erkennen", () => {
    expect(normalizeMerchantName("NETFLIX INTERNATIONAL B.V.")).toBe("netflix international");
    // „amazon" und nicht „amazon eu": Das alleinstehende Länderkürzel fällt
    // weg, und damit trifft „AMAZON EU SARL" dieselbe Familie wie
    // „AMAZON.DE" — genau der Zweck.
    expect(normalizeMerchantName("AMAZON EU SARL")).toBe("amazon");
    expect(normalizeMerchantName("AMAZON.DE")).toBe("amazon");
  });

  it("sollte ein alleinstehendes Länderkürzel am Ende verwerfen", () => {
    expect(normalizeMerchantName("SPOTIFY AB DE")).toBe("spotify ab");
  });

  it("sollte einen Händlernamen NICHT verstümmeln, der wie ein Ort aussieht", () => {
    // Kein Städte-Wortfilter: „Frankfurter Allgemeine" ist ein Zeitungsname,
    // kein Ortszusatz — er steht nicht hinter `//`.
    expect(normalizeMerchantName("Frankfurter Allgemeine Zeitung")).toBe("frankfurter allgemeine zeitung");
    expect(normalizeMerchantName("Berliner Sparkasse")).toBe("berliner sparkasse");
  });

  it("sollte einen Punkt im Namen behalten, der keine TLD ist", () => {
    expect(normalizeMerchantName("Dr. Mueller")).toBe("dr. mueller");
  });

  it("sollte idempotent sein — die eigene Ausgabe bleibt unverändert", () => {
    // Trägt die Abwärtskompatibilität: Ein ALT gespeicherter Wert
    // („netflix.com") muss sich durch erneutes Normalisieren in die neue Form
    // überführen lassen, damit gespeicherte Regeln und Vertragsentscheidungen
    // ohne Datenmigration weiter greifen.
    for (const roh of ["REWE SAGT DANKE 3847 DE//MUENCHEN/2024-01-05", "NETFLIX.COM", "Muster GmbH & Co. KG"]) {
      const einmal = normalizeMerchantName(roh);
      expect(normalizeMerchantName(einmal)).toBe(einmal);
    }
  });
});
