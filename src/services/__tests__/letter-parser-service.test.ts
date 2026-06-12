import { describe, expect, it } from "vitest";
import {
  classifyDocType,
  isValidIban,
  LOW_CONFIDENCE_THRESHOLD,
  lowConfidenceFields,
  parseGermanAmount,
  parseLetter,
} from "../letter-parser-service";
import { LETTER_CORPUS } from "./letter-parser-corpus";

describe("parseGermanAmount", () => {
  it("parses German number formats", () => {
    expect(parseGermanAmount("1.234,56")).toBe(1234.56);
    expect(parseGermanAmount("87,90 €")).toBe(87.9);
    expect(parseGermanAmount("49,9")).toBe(49.9);
    expect(parseGermanAmount("312")).toBe(312);
  });

  it("repairs OCR digit confusions (O→0, l→1)", () => {
    expect(parseGermanAmount("12O,5O")).toBe(120.5);
    expect(parseGermanAmount("l2,00")).toBe(12);
  });

  it("rejects garbage", () => {
    expect(parseGermanAmount("")).toBeNull();
    expect(parseGermanAmount("abc")).toBeNull();
  });
});

describe("isValidIban (Mod-97)", () => {
  it("accepts valid IBANs", () => {
    expect(isValidIban("DE89370400440532013000")).toBe(true);
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("DE02120300000000202051")).toBe(true);
  });

  it("rejects invalid checksums and lengths", () => {
    expect(isValidIban("DE89370400440532013001")).toBe(false);
    expect(isValidIban("DE8937040044053201300")).toBe(false);
    expect(isValidIban("XX00")).toBe(false);
  });
});

describe("classifyDocType", () => {
  it("prioritises Mahnbescheid over everything", () => {
    const r = classifyDocType("Amtsgericht Coburg\nMahnbescheid\nMahnung Rechnung Inkasso");
    expect(r.value).toBe("mahnbescheid");
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("classifies '2. und letzte Mahnung' as mahnung_2_plus", () => {
    expect(classifyDocType("2. und letzte Mahnung").value).toBe("mahnung_2_plus");
  });

  it("marks a bare 'Mahnung' with low confidence", () => {
    const r = classifyDocType("Mahnung\nGesamtbetrag: 10,00 €");
    expect(r.value).toBe("mahnung_1");
    expect(r.confidence).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
  });
});

describe("Testkorpus (synthetische Musterbriefe)", () => {
  it(`enthält mindestens 20 Briefe`, () => {
    expect(LETTER_CORPUS.length).toBeGreaterThanOrEqual(20);
  });

  for (const letter of LETTER_CORPUS) {
    it(letter.name, () => {
      const parsed = parseLetter(letter.text);
      const e = letter.expected;

      expect(parsed.docType.value).toBe(e.docType);
      if (e.creditor !== undefined) expect(parsed.creditor?.value).toBe(e.creditor);
      if (e.originalCreditor !== undefined)
        expect(parsed.originalCreditor?.value).toBe(e.originalCreditor);
      if ("aktenzeichen" in e) expect(parsed.aktenzeichen?.value).toBe(e.aktenzeichen);
      if ("kundennummer" in e) expect(parsed.kundennummer?.value).toBe(e.kundennummer);
      if ("rechnungsnummer" in e)
        expect(parsed.rechnungsnummer?.value).toBe(e.rechnungsnummer);
      if ("hauptforderung" in e)
        expect(parsed.amounts.hauptforderung?.value).toBe(e.hauptforderung);
      if ("mahngebuehren" in e)
        expect(parsed.amounts.mahngebuehren?.value).toBe(e.mahngebuehren);
      if ("verzugszinsen" in e)
        expect(parsed.amounts.verzugszinsen?.value).toBe(e.verzugszinsen);
      if ("gesamtbetrag" in e)
        expect(parsed.amounts.gesamtbetrag?.value).toBe(e.gesamtbetrag);
      if ("iban" in e) expect(parsed.iban?.value).toBe(e.iban);
      if ("briefDatum" in e) expect(parsed.briefDatum?.value).toBe(e.briefDatum);
      if ("zahlungsfrist" in e) expect(parsed.zahlungsfrist?.value).toBe(e.zahlungsfrist);
    });
  }
});

describe("Confidence-Verhalten", () => {
  it("hebt Beträge an, wenn Teilsummen den Gesamtbetrag ergeben", () => {
    const letter = LETTER_CORPUS.find((l) => l.name === "Versandhandel: 1. Mahnung")!;
    const parsed = parseLetter(letter.text);
    expect(parsed.amounts.gesamtbetrag!.confidence).toBeGreaterThan(0.9);
  });

  it("markiert inkonsistente Gesamtbeträge als unsicher", () => {
    const letter = LETTER_CORPUS.find((l) =>
      l.name.startsWith("Inkonsistente Summen"),
    )!;
    const parsed = parseLetter(letter.text);
    expect(parsed.amounts.gesamtbetrag!.confidence).toBeLessThan(
      LOW_CONFIDENCE_THRESHOLD,
    );
    expect(lowConfidenceFields(parsed)).toContain("gesamtbetrag");
  });

  it("reparierte IBANs tragen reduzierte Confidence", () => {
    const letter = LETTER_CORPUS.find((l) => l.name.includes("IBAN mit O statt 0"))!;
    const parsed = parseLetter(letter.text);
    expect(parsed.iban?.value).toBe("DE89370400440532013000");
    expect(parsed.iban!.confidence).toBeLessThan(0.9);
  });

  it("listet unsichere Felder für die Review-UI", () => {
    const letter = LETTER_CORPUS.find((l) => l.name === "Unklassifizierbares Schreiben")!;
    const parsed = parseLetter(letter.text);
    expect(lowConfidenceFields(parsed)).toContain("docType");
  });
});

describe("Inkasso: Ursprungsgläubiger", () => {
  it("extrahiert den Ursprungsgläubiger aus allen Formulierungsvarianten", () => {
    const inkassoLetters = LETTER_CORPUS.filter((l) => l.expected.docType === "inkasso");
    expect(inkassoLetters.length).toBeGreaterThanOrEqual(3);
    for (const letter of inkassoLetters) {
      if (letter.expected.originalCreditor) {
        const parsed = parseLetter(letter.text);
        expect(parsed.originalCreditor?.value).toBe(letter.expected.originalCreditor);
      }
    }
  });
});
