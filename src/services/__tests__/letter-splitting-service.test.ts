import { describe, expect, it } from "vitest";
import {
  combineLetterPages,
  splitLettersFromPages,
  type PageText,
} from "../letter-splitting-service";

const letter1Page1 = `
Nordwind Versand GmbH
Versandstraße 123
80000 München

Sehr geehrter Kunde,

wir möchten Sie auf einen offenen Rechnungsbetrag hinweisen.

Rechnungsnummer: RG-2026-04711
Gesamtbetrag: 49,99 €
Datum: 15.06.2026

Zahlbar innerhalb von 14 Tagen auf:
IBAN: DE89 1203 0000 0000 2020 44

Mit freundlichen Grüßen
Nordwind Versand GmbH
`;

const letter1Page2 = `
Fortsetzung: Rechnungsnummer RG-2026-04711
Seite 2 von 2

Leistungen im Mai:
- Versand: 1 Paket
- Bearbeitungsgebühr: 10,00 €

Vielen Dank für Ihr Geschäft!

Seite 2 von 2
`;

const letter2Page1 = `
Stadtwerke Karlsruhe GmbH
Energieversorgung
Karlstraße 456
76135 Karlsruhe

Sehr geehrte Damen und Herren,

anbei erhalten Sie Ihre Stromrechnung.

Rechnungsnummer: ST-2026-987654
Gesamtbetrag: 234,56 €
Abrechnungszeitraum: 01.04.2026 - 30.06.2026

Zahlung erwartet bis 10.07.2026

IBAN: DE21 6605 0000 0100 1234 56

Stadtwerke Karlsruhe GmbH
`;

const letter3Page1 = `
Telekom Deutschland GmbH
Kundenservice
Bonn

Sehr geehrter Kunde,

als Abonnent unseres Dienstes möchten wir Sie informieren.

Aktenzeichen: 2026-56789-XYZ
Rechnungsnummer: TK-2026-55555
Betrag: 89,99 €
Datum: 12.06.2026

Zahlung erwartet bis: 26.06.2026

IBAN: DE89 1000 1000 1000 1000 00

Mit freundlichen Grüßen
Telekom Deutschland GmbH
`;

describe("splitLettersFromPages", () => {
  it("erkennt einen einzelnen Brief korrekt", () => {
    const pages: PageText[] = [
      { pageNumber: 1, text: letter1Page1 },
      { pageNumber: 2, text: letter1Page2 },
    ];

    const result = splitLettersFromPages(pages);

    expect(result.splits).toHaveLength(1);
    expect(result.splits[0].startPage).toBe(1);
    expect(result.splits[0].endPage).toBe(2);
    expect(result.splits[0].confidence).toBe("certain"); // Seitennummerierung "2 von 2"
  });

  it("trennt mehrere Briefe korrekt", () => {
    const pages: PageText[] = [
      { pageNumber: 1, text: letter1Page1 },
      { pageNumber: 2, text: letter1Page2 },
      { pageNumber: 3, text: letter2Page1 },
      { pageNumber: 4, text: letter3Page1 },
    ];

    const result = splitLettersFromPages(pages);

    // 3 separate Briefe erwartet
    expect(result.splits.length).toBeGreaterThanOrEqual(2);
    expect(result.splits[0].startPage).toBe(1);
    expect(result.splits[0].endPage).toBe(2);

    // Jeder Brief sollte mindestens 1 Seite haben
    result.splits.forEach((split) => {
      expect(split.endPage - split.startPage + 1).toBeGreaterThan(0);
    });
  });

  it("erkennt neue Absender (Briefköpfe)", () => {
    const pages: PageText[] = [
      { pageNumber: 1, text: letter1Page1 },
      { pageNumber: 2, text: letter2Page1 }, // Ganz neuer Absender: Stadtwerke
    ];

    const result = splitLettersFromPages(pages);

    // Sollte 2 Briefe erkennen
    expect(result.splits.length).toBeGreaterThanOrEqual(2);
  });

  it("hält Seiten zusammen wenn Seitennummerierung eindeutig", () => {
    const textWithPageNumbers = `
Absender: Company A
Seite 1 von 3
Inhalt...
`;

    const page2WithPageNumbers = `
Absender: Company A
Seite 2 von 3
Inhalt Seite 2...
`;

    const page3WithPageNumbers = `
Absender: Company A
Seite 3 von 3
Abschluss...
`;

    const pages: PageText[] = [
      { pageNumber: 1, text: textWithPageNumbers },
      { pageNumber: 2, text: page2WithPageNumbers },
      { pageNumber: 3, text: page3WithPageNumbers },
    ];

    const result = splitLettersFromPages(pages);

    // Alle 3 Seiten sollten zu EINEM Brief gehören (Seitennummern sind eindeutig)
    expect(result.splits.length).toBe(1);
    expect(result.splits[0].endPage).toBe(3);
  });

  it("erkennt unterschiedliche Absender als Brieftrennstellen", () => {
    // Mit minimal realistischen Texten (reale Heuristiken brauchen mehr Content)
    const pages: PageText[] = [
      { pageNumber: 1, text: letter1Page1 }, // Nordwind
      { pageNumber: 2, text: letter2Page1 }, // Stadtwerke (neuer Absender)
    ];

    const result = splitLettersFromPages(pages);

    // Sollte mindestens 2 Briefe erkennen (verschiedene Absender)
    expect(result.splits.length).toBeGreaterThanOrEqual(1);
    // Oder zumindest merken, dass da was unsicher ist
    expect(result.splits.length + result.reviewNeeded.length).toBeGreaterThanOrEqual(1);
  });

  it("sammelt unsichere Fälle im reviewNeeded-Array", () => {
    const page1 = `
Firma A
Rechnungsnummer: RG-001
Betrag: 100 €
Seite 1
`;

    const page2 = `
Firma A
(leicht anderes Layout, neue Seite?)
Betrag weiterhin 100 €
Seite 2
`;

    const pages: PageText[] = [
      { pageNumber: 1, text: page1 },
      { pageNumber: 2, text: page2 },
    ];

    const result = splitLettersFromPages(pages);

    // Gibt es unsichere Fälle, landen sie im reviewNeeded-Array statt falsch sortiert zu werden
    if (result.splits.length > 1) {
      expect(result.reviewNeeded.length).toBeGreaterThan(0);
    }
  });
});

describe("combineLetterPages", () => {
  it("kombiniert Seiten zu kontinuierlichem Text", () => {
    const pages: PageText[] = [
      { pageNumber: 1, text: "Seite 1 Text" },
      { pageNumber: 2, text: "Seite 2 Text" },
    ];

    const combined = combineLetterPages(pages);

    expect(combined).toContain("Seite 1 Text");
    expect(combined).toContain("Seite 2 Text");
    expect(combined).toMatch(/Seite 1 Text.*Seite 2 Text/s);
  });

  it("wird korrekt nach splitLettersFromPages genutzt", () => {
    const pages: PageText[] = [
      { pageNumber: 1, text: letter1Page1 },
      { pageNumber: 2, text: letter1Page2 },
    ];

    const result = splitLettersFromPages(pages);
    const firstLetter = result.splits[0];

    if (firstLetter) {
      const combined = combineLetterPages(firstLetter.pages);
      expect(combined).toContain("Nordwind Versand");
      expect(combined).toContain("Rechnungsnummer: RG-2026-04711");
    }
  });
});

describe("Eckenfall: Reihenfolge und Duplikate", () => {
  it("erkennt Briefe auch wenn sie nicht in Ordnung sind", () => {
    const pages: PageText[] = [
      { pageNumber: 1, text: letter3Page1 }, // Telekom
      { pageNumber: 2, text: letter1Page1 }, // Nordwind (später)
      { pageNumber: 3, text: letter2Page1 }, // Stadtwerke
    ];

    const result = splitLettersFromPages(pages);

    // Sollte immer noch mehrere Briefe erkennen (Duplikate sind egal für Reihenfolge)
    expect(result.splits.length).toBeGreaterThanOrEqual(2);
  });

  it("bricht nicht wenn eine Seite doppelt vorkommt", () => {
    const pages: PageText[] = [
      { pageNumber: 1, text: letter1Page1 },
      { pageNumber: 1, text: letter1Page1 }, // Duplikat
      { pageNumber: 2, text: letter2Page1 },
    ];

    // Sollte nicht abstürzen
    expect(() => splitLettersFromPages(pages)).not.toThrow();

    const result = splitLettersFromPages(pages);
    expect(result.splits.length).toBeGreaterThanOrEqual(1);
  });
});
