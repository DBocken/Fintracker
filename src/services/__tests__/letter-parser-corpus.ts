// Synthetischer Testkorpus für den Brief-Parser (Issue #45).
// Alle Briefe, Namen, Nummern und IBANs sind erfunden bzw. öffentliche Beispiel-IBANs.

import type { LetterDocType } from "../letter-parser-service";

export interface CorpusLetter {
  name: string;
  text: string;
  expected: {
    docType: LetterDocType;
    creditor?: string;
    originalCreditor?: string;
    aktenzeichen?: string;
    kundennummer?: string;
    rechnungsnummer?: string;
    hauptforderung?: number;
    mahngebuehren?: number;
    verzugszinsen?: number;
    gesamtbetrag?: number;
    iban?: string;
    briefDatum?: string;
    zahlungsfrist?: string;
  };
}

export const LETTER_CORPUS: CorpusLetter[] = [
  {
    name: "Versandhandel: Rechnung",
    text: `Nordwind Versand GmbH
Postfach 1234, 20095 Hamburg

Max Mustermann
Beispielweg 1
10115 Berlin

Hamburg, den 02.03.2026

Rechnung
Rechnungsnummer: RG-2026-04711
Kundennummer: 882244

Rechnungsbetrag: 49,90 €

Bitte überweisen Sie den Betrag bis zum 16.03.2026 auf folgendes Konto:
IBAN: DE89 3704 0044 0532 0130 00
Verwendungszweck: RG-2026-04711`,
    expected: {
      docType: "rechnung",
      creditor: "Nordwind Versand GmbH",
      rechnungsnummer: "RG-2026-04711",
      kundennummer: "882244",
      hauptforderung: 49.9,
      iban: "DE89370400440532013000",
      briefDatum: "2026-03-02",
      zahlungsfrist: "2026-03-16",
    },
  },
  {
    name: "Versandhandel: Zahlungserinnerung",
    text: `Nordwind Versand GmbH
Hamburg, den 24.03.2026

Zahlungserinnerung

Sehr geehrter Herr Mustermann,
sicher haben Sie es nur übersehen: Unsere Rechnungsnummer RG-2026-04711 ist noch offen.

Offener Betrag: 49,90 €

Bitte zahlen Sie bis zum 07.04.2026.
IBAN: DE89 3704 0044 0532 0130 00`,
    expected: {
      docType: "zahlungserinnerung",
      creditor: "Nordwind Versand GmbH",
      gesamtbetrag: 49.9,
      iban: "DE89370400440532013000",
      zahlungsfrist: "2026-04-07",
    },
  },
  {
    name: "Versandhandel: 1. Mahnung",
    text: `Nordwind Versand GmbH
Hamburg, den 14.04.2026

1. Mahnung
Rechnungsnummer: RG-2026-04711

Hauptforderung: 49,90 €
Mahngebühr: 2,50 €
Gesamtbetrag: 52,40 €

Zahlbar bis 28.04.2026 auf IBAN DE89 3704 0044 0532 0130 00`,
    expected: {
      docType: "mahnung_1",
      hauptforderung: 49.9,
      mahngebuehren: 2.5,
      gesamtbetrag: 52.4,
      iban: "DE89370400440532013000",
      zahlungsfrist: "2026-04-28",
    },
  },
  {
    name: "Versandhandel: 2. Mahnung",
    text: `Nordwind Versand GmbH
Hamburg, den 05.05.2026

2. Mahnung
Rechnungsnummer: RG-2026-04711

Hauptforderung: 49,90 €
Mahngebühren: 7,50 €
Verzugszinsen: 0,60 €
Gesamtbetrag: 58,00 €

Frist bis zum 19.05.2026`,
    expected: {
      docType: "mahnung_2_plus",
      hauptforderung: 49.9,
      mahngebuehren: 7.5,
      verzugszinsen: 0.6,
      gesamtbetrag: 58.0,
      zahlungsfrist: "2026-05-19",
    },
  },
  {
    name: "Telekommunikation: Rechnung",
    text: `TelCo Deutschland GmbH
Bonn, den 01.04.2026

Ihre Rechnung für März 2026
Kundennummer: K-553311
Rechnungsnummer: 2026-03-998877

Rechnungsbetrag: 39,95 €
Zahlbar bis 15.04.2026
IBAN: DE02 1203 0000 0000 2020 51`,
    expected: {
      docType: "rechnung",
      creditor: "TelCo Deutschland GmbH",
      kundennummer: "K-553311",
      rechnungsnummer: "2026-03-998877",
      hauptforderung: 39.95,
      iban: "DE02120300000000202051",
      zahlungsfrist: "2026-04-15",
    },
  },
  {
    name: "Telekommunikation: 1. Mahnung",
    text: `TelCo Deutschland GmbH
Bonn, den 22.04.2026

1. Mahnung
Kundennummer: K-553311

Hauptforderung: 39,95 €
Mahngebühr: 3,00 €
Gesamtbetrag: 42,95 €`,
    expected: {
      docType: "mahnung_1",
      kundennummer: "K-553311",
      hauptforderung: 39.95,
      mahngebuehren: 3.0,
      gesamtbetrag: 42.95,
    },
  },
  {
    name: "Telekommunikation: letzte Mahnung",
    text: `TelCo Deutschland GmbH
Bonn, den 12.05.2026

Letzte Mahnung vor Übergabe an ein Inkassounternehmen

Kundennummer: K-553311
Gesamtbetrag: 47,95 €
Zahlbar bis 26.05.2026`,
    expected: {
      docType: "mahnung_2_plus",
      gesamtbetrag: 47.95,
      zahlungsfrist: "2026-05-26",
    },
  },
  {
    name: "Energie: Rechnung Stadtwerke",
    text: `Stadtwerke Musterstadt GmbH
Musterstadt, den 10.02.2026

Jahresabrechnung Strom
Kundennummer: SW-100200

Rechnungsbetrag: 312,44 €
Zahlbar bis 24.02.2026
IBAN: DE02 5001 0517 0137 0750 30`,
    expected: {
      docType: "rechnung",
      creditor: "Stadtwerke Musterstadt GmbH",
      kundennummer: "SW-100200",
      hauptforderung: 312.44,
      iban: "DE02500105170137075030",
      zahlungsfrist: "2026-02-24",
    },
  },
  {
    name: "Energie: 1. Mahnung",
    text: `Stadtwerke Musterstadt GmbH
Musterstadt, den 10.03.2026

Mahnung
Kundennummer: SW-100200

Hauptforderung: 312,44 €
Mahngebühr: 5,00 €
Gesamtbetrag: 317,44 €`,
    expected: {
      docType: "mahnung_1",
      hauptforderung: 312.44,
      mahngebuehren: 5.0,
      gesamtbetrag: 317.44,
    },
  },
  {
    name: "Energie: 2. Mahnung mit Sperrandrohung",
    text: `Stadtwerke Musterstadt GmbH
Musterstadt, den 31.03.2026

2. Mahnung — Ankündigung der Unterbrechung der Versorgung
Kundennummer: SW-100200

Hauptforderung: 312,44 €
Mahngebühren: 12,50 €
Verzugszinsen: 1,80 €
Gesamtbetrag: 326,74 €

Frist bis zum 14.04.2026`,
    expected: {
      docType: "mahnung_2_plus",
      hauptforderung: 312.44,
      mahngebuehren: 12.5,
      verzugszinsen: 1.8,
      gesamtbetrag: 326.74,
      zahlungsfrist: "2026-04-14",
    },
  },
  {
    name: "Inkasso: Erstschreiben mit Gläubiger-Zeile",
    text: `Cura Inkasso GmbH
Frankfurt, den 02.06.2026

Aktenzeichen: IK-2026-0815
Gläubiger: Nordwind Versand GmbH
Rechnungsnummer: RG-2026-04711

Hauptforderung: 49,90 €
Mahngebühren: 12,00 €
Verzugszinsen: 1,10 €
Gesamtbetrag: 63,00 €

Zahlbar bis 16.06.2026
IBAN: DE02 1005 0000 0054 5404 02
Verwendungszweck: IK-2026-0815`,
    expected: {
      docType: "inkasso",
      creditor: "Cura Inkasso GmbH",
      originalCreditor: "Nordwind Versand GmbH",
      aktenzeichen: "IK-2026-0815",
      rechnungsnummer: "RG-2026-04711",
      hauptforderung: 49.9,
      mahngebuehren: 12.0,
      verzugszinsen: 1.1,
      gesamtbetrag: 63.0,
      iban: "DE02100500000054540402",
      zahlungsfrist: "2026-06-16",
    },
  },
  {
    name: "Inkasso: „Forderung der …“-Formulierung",
    text: `Rhein Forderungsmanagement GmbH
Köln, den 05.06.2026

Aktenzeichen: RF-77-2026

Wir machen die Forderung der TelCo Deutschland GmbH aus der Rechnung 2026-03-998877 geltend.

Gesamtbetrag: 78,45 €
IBAN: DE75 5121 0800 1245 1261 99`,
    expected: {
      docType: "inkasso",
      originalCreditor: "TelCo Deutschland GmbH",
      aktenzeichen: "RF-77-2026",
      gesamtbetrag: 78.45,
      iban: "DE75512108001245126199",
    },
  },
  {
    name: "Inkasso: „im Auftrag unserer Mandantin“",
    text: `Hanse Inkasso GmbH
Hamburg, den 08.06.2026

Aktenzeichen: HI-2026-3344

Im Auftrag unserer Mandantin, der Stadtwerke Musterstadt GmbH, fordern wir Sie zur Zahlung auf.

Gesamtbetrag: 341,20 €
Zahlbar bis 22.06.2026`,
    expected: {
      docType: "inkasso",
      creditor: "Hanse Inkasso GmbH",
      originalCreditor: "Stadtwerke Musterstadt GmbH",
      aktenzeichen: "HI-2026-3344",
      gesamtbetrag: 341.2,
      zahlungsfrist: "2026-06-22",
    },
  },
  {
    name: "Inkasso: Folgeschreiben mit erhöhten Gebühren",
    text: `Cura Inkasso GmbH
Frankfurt, den 30.06.2026

Aktenzeichen: IK-2026-0815
Gläubiger: Nordwind Versand GmbH

Hauptforderung: 49,90 €
Mahngebühren: 35,00 €
Verzugszinsen: 2,10 €
Gesamtbetrag: 87,00 €`,
    expected: {
      docType: "inkasso",
      originalCreditor: "Nordwind Versand GmbH",
      aktenzeichen: "IK-2026-0815",
      hauptforderung: 49.9,
      mahngebuehren: 35.0,
      verzugszinsen: 2.1,
      gesamtbetrag: 87.0,
    },
  },
  {
    name: "Gerichtlicher Mahnbescheid",
    text: `Amtsgericht Coburg
Zentrales Mahngericht

Mahnbescheid

Geschäftszeichen: 26-1234567-0-9
Gläubiger: Nordwind Versand GmbH

Hauptforderung: 49,90 €
Gesamtbetrag: 142,50 €

Gegen diesen Mahnbescheid können Sie innerhalb von 14 Tagen Widerspruch erheben.`,
    expected: {
      docType: "mahnbescheid",
      originalCreditor: "Nordwind Versand GmbH",
      aktenzeichen: "26-1234567-0-9",
      hauptforderung: 49.9,
    },
  },
  {
    name: "OCR-Fehler: IBAN mit O statt 0",
    text: `Nordwind Versand GmbH

1. Mahnung
Gesamtbetrag: 52,40 €
IBAN: DE89 37O4 OO44 O532 O13O OO`,
    expected: {
      docType: "mahnung_1",
      gesamtbetrag: 52.4,
      iban: "DE89370400440532013000",
    },
  },
  {
    name: "OCR-Fehler: fehlende Leerzeichen",
    text: `TelCo Deutschland GmbH
2.Mahnung
Kundennummer:K-553311
Gesamtbetrag:87,90EUR
Zahlbar bis 30.06.2026`,
    expected: {
      docType: "mahnung_2_plus",
      kundennummer: "K-553311",
      gesamtbetrag: 87.9,
      zahlungsfrist: "2026-06-30",
    },
  },
  {
    name: "OCR-Fehler: Betrag mit O/l-Verwechslung",
    text: `Stadtwerke Musterstadt GmbH
Mahnung
Gesamtbetrag: 12O,5O €`,
    expected: {
      docType: "mahnung_1",
      gesamtbetrag: 120.5,
    },
  },
  {
    name: "Ungültige IBAN wird abgewiesen",
    text: `Nordwind Versand GmbH
Rechnung
Rechnungsbetrag: 19,99 €
IBAN: DE89 3704 0044 0532 0130 01`,
    expected: {
      docType: "rechnung",
      hauptforderung: 19.99,
      iban: undefined,
    },
  },
  {
    name: "Fitnessstudio: Mahnung mit ausgeschriebenem Datum",
    text: `FitZone Studio Betriebs GmbH
München, den 3. Mai 2026

1. Mahnung
Kundennummer: FZ-9001

Hauptforderung: 29,90 €
Mahngebühr: 2,00 €
Gesamtbetrag: 31,90 €`,
    expected: {
      docType: "mahnung_1",
      kundennummer: "FZ-9001",
      hauptforderung: 29.9,
      mahngebuehren: 2.0,
      gesamtbetrag: 31.9,
      briefDatum: "2026-05-03",
    },
  },
  {
    name: "Unklassifizierbares Schreiben",
    text: `Hausverwaltung Schmidt
Information zu Ihrem Mietverhältnis

Sehr geehrter Herr Mustermann,
hiermit informieren wir Sie über die anstehende Wartung der Heizungsanlage.`,
    expected: {
      docType: "unbekannt",
    },
  },
  {
    name: "Mahnung ohne Stufenangabe (niedrige Confidence)",
    text: `Nordwind Versand GmbH

Mahnung
Gesamtbetrag: 52,40 €`,
    expected: {
      docType: "mahnung_1",
      gesamtbetrag: 52.4,
    },
  },
  {
    name: "Inkonsistente Summen (Gesamtbetrag unsicher)",
    text: `Nordwind Versand GmbH
2. Mahnung
Hauptforderung: 49,90 €
Mahngebühren: 2,50 €
Gesamtbetrag: 99,00 €`,
    expected: {
      docType: "mahnung_2_plus",
      hauptforderung: 49.9,
      mahngebuehren: 2.5,
      gesamtbetrag: 99.0,
    },
  },
];
