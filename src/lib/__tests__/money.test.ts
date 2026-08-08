import { describe, it, expect } from "vitest";
import { toMinor, toMajor, sumMinor, parseGermanNumber, parseEuroInput } from "../money";

describe("money", () => {
  it("konvertiert 2-Dezimal-Euro exakt in Cent", () => {
    expect(toMinor(12.5)).toBe(1250);
    expect(toMinor(19.99)).toBe(1999);
    expect(toMinor(5.1)).toBe(510);
    expect(toMinor(0)).toBe(0);
  });

  it("behandelt Float-Drift korrekt", () => {
    expect(toMinor(0.1 + 0.2)).toBe(30);
  });

  it("erhält das Vorzeichen", () => {
    expect(toMinor(-9.99)).toBe(-999);
    expect(toMinor(-0.01)).toBe(-1);
  });

  it("round-trip toMajor(toMinor(x)) ist verlustfrei für 2 Dezimalstellen", () => {
    for (const x of [0, 1.23, -4.56, 1000.99, -0.07]) {
      expect(toMajor(toMinor(x))).toBeCloseTo(x, 2);
    }
  });

  it("summiert Cent-Listen als Integer", () => {
    expect(sumMinor([333, 333, 334])).toBe(1000);
    expect(sumMinor([])).toBe(0);
  });

  it("summiert negative und gemischte Vorzeichen korrekt", () => {
    expect(sumMinor([-1000, 500, -250])).toBe(-750);
  });
});

describe("parseGermanNumber / parseEuroInput", () => {
  it("[REGRESSION] liest deutschen Tausenderpunkt korrekt (1.200 = 1200, nicht 1,20)", () => {
    expect(parseGermanNumber("1.200")).toBe(1200);
    expect(parseGermanNumber("1.234,56")).toBe(1234.56);
    expect(parseGermanNumber("1.234.567")).toBe(1234567);
  });

  it("liest den Tausenderpunkt auch bei NEGATIVEN Betraegen (-1.200 = -1200)", () => {
    // Das Vorzeichen im Tausender-Muster (`/^-?\d{1,3}(\.\d{3})+$/`) war bis
    // WP 2.1 ungetestet: ohne das `-?` faellt "-1.200" durch die Erkennung,
    // der Punkt bleibt Dezimaltrenner, und parseFloat liefert lautlos -1,2 —
    // ein Faktor 1000 auf einer Rueckzahlung, Abbuchung oder Gutschrift.
    // Keiner der uebrigen Faelle haette angeschlagen, weil alle positiv sind.
    expect(parseGermanNumber("-1.200")).toBe(-1200);
    expect(parseGermanNumber("-1.234,56")).toBe(-1234.56);
    expect(parseGermanNumber("-1.234.567")).toBe(-1234567);
  });

  it("liest einfache Dezimalformate (Komma und Punkt)", () => {
    expect(parseGermanNumber("12,34")).toBe(12.34);
    expect(parseGermanNumber("12.50")).toBe(12.5);
    expect(parseGermanNumber("0,99")).toBe(0.99);
    expect(parseGermanNumber("-45,00")).toBe(-45);
  });

  it("ignoriert Währungssymbole und Leerzeichen", () => {
    expect(parseGermanNumber(" 1.200,00 € ")).toBe(1200);
    expect(parseGermanNumber("EUR 12,34")).toBe(12.34);
  });

  it("gibt null bei ungültiger Eingabe zurück", () => {
    expect(parseGermanNumber("abc")).toBeNull();
    expect(parseGermanNumber("")).toBeNull();
    expect(parseGermanNumber("-")).toBeNull();
    expect(parseGermanNumber(null)).toBeNull();
    expect(parseGermanNumber(undefined)).toBeNull();
    expect(parseGermanNumber(NaN)).toBeNull();
  });

  it("übernimmt numerische Eingaben unverändert", () => {
    expect(parseGermanNumber(42.5)).toBe(42.5);
    expect(parseGermanNumber(-3)).toBe(-3);
  });

  it("parseEuroInput wirft bei ungültiger Eingabe statt still 0 zu liefern", () => {
    expect(parseEuroInput("1.200")).toBe(1200);
    expect(() => parseEuroInput("abc")).toThrow();
    expect(() => parseEuroInput("")).toThrow();
  });
});
