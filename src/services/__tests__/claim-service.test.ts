import { describe, expect, it } from "vitest";
import { parseLetter } from "../letter-parser-service";
import {
  applyLetterToClaim,
  claimFromLetter,
  creditorKey,
  doublePaymentWarning,
  feeEscalation,
  groupLettersIntoClaims,
  matchLetter,
  similarReference,
  type Claim,
} from "../claim-service";
import { LETTER_CORPUS } from "./letter-parser-corpus";

function corpusText(name: string): string {
  const letter = LETTER_CORPUS.find((l) => l.name === name);
  if (!letter) throw new Error(`Korpus-Brief fehlt: ${name}`);
  return letter.text;
}

const NORDWIND_CHAIN = [
  "Versandhandel: Rechnung",
  "Versandhandel: Zahlungserinnerung",
  "Versandhandel: 1. Mahnung",
  "Versandhandel: 2. Mahnung",
  "Inkasso: Erstschreiben mit Gläubiger-Zeile",
  "Inkasso: Folgeschreiben mit erhöhten Gebühren",
].map(corpusText);

describe("creditorKey / similarReference", () => {
  it("normalisiert Rechtsformen und Satzzeichen", () => {
    expect(creditorKey("Nordwind Versand GmbH")).toBe(creditorKey("NORDWIND VERSAND"));
    expect(creditorKey("TelCo Deutschland GmbH & Co. KG")).toBe(
      creditorKey("Telco Deutschland"),
    );
  });

  it("erkennt ähnliche Verwendungszwecke über gemeinsame Tokens", () => {
    expect(similarReference("RG-2026-04711", "Rechnung RG-2026-04711 offen")).toBe(true);
    expect(similarReference("RG-2026-04711", "KD 998877")).toBe(false);
    expect(similarReference(null, "RG-2026-04711")).toBe(false);
  });
});

describe("Matching-Stufen", () => {
  it("Stufe 1 (sicher): gleicher Gläubiger + gleiches Aktenzeichen", () => {
    const claim = claimFromLetter(parseLetter(corpusText("Versandhandel: Rechnung")));
    const mahnung = parseLetter(corpusText("Versandhandel: 1. Mahnung"));
    const match = matchLetter(mahnung, [claim]);
    expect(match?.level).toBe("sicher");
    expect(match?.requiresConfirmation).toBe(false);
  });

  it("Stufe 2 (stark): gleiche IBAN + ähnlicher Verwendungszweck, anderer Absender", () => {
    const claim = claimFromLetter(parseLetter(corpusText("Versandhandel: Rechnung")));
    const letter = parseLetter(`Zahlungsservice Nord AG

Zahlungsaufforderung wegen offener Rechnung

Offener Betrag: 49,90 €
IBAN: DE89 3704 0044 0532 0130 00
Verwendungszweck: RG-2026-04711`);
    const match = matchLetter(letter, [claim]);
    expect(match?.level).toBe("stark");
  });

  it("Stufe 3 (wahrscheinlich): gleicher Gläubiger + Betrag = Vorbetrag + Gebühren, ohne Referenz", () => {
    const claim = claimFromLetter(parseLetter(corpusText("Versandhandel: Rechnung")));
    const letter = parseLetter(`Nordwind Versand GmbH

Mahnung
Gesamtbetrag: 52,40 €`);
    const match = matchLetter(letter, [claim]);
    expect(match?.level).toBe("wahrscheinlich");
    expect(match?.requiresConfirmation).toBe(true);
  });

  it("Stufe 4 (Inkasso-Übergabe): Absender wechselt, Match über Ursprungsgläubiger + Rechnungsnummer", () => {
    const claim = claimFromLetter(parseLetter(corpusText("Versandhandel: Rechnung")));
    const inkasso = parseLetter(corpusText("Inkasso: Erstschreiben mit Gläubiger-Zeile"));
    const match = matchLetter(inkasso, [claim]);
    expect(match?.level).toBe("inkasso_uebergabe");
    expect(match?.message).toContain("keine neue Schuld");
    expect(match?.message).toContain("Eine Forderung, nicht zwei");
  });

  it("Nicht-Match: zwei echte verschiedene Forderungen desselben Gläubigers", () => {
    const claim = claimFromLetter(parseLetter(corpusText("Versandhandel: Rechnung"))); // 49,90 €
    const other = parseLetter(`Nordwind Versand GmbH

Rechnung
Rechnungsnummer: RG-2026-09999
Rechnungsbetrag: 219,00 €`);
    expect(matchLetter(other, [claim])).toBeNull();
  });

  it("Nicht-Match: fremder Gläubiger, fremde IBAN", () => {
    const claim = claimFromLetter(parseLetter(corpusText("Versandhandel: Rechnung")));
    const telco = parseLetter(corpusText("Telekommunikation: Rechnung"));
    expect(matchLetter(telco, [claim])).toBeNull();
  });
});

describe("Inkasso-Übergabe: Aktenführung", () => {
  it("wechselt Zahlstelle/Gläubiger und hält den Ursprungsgläubiger fest", () => {
    let claim = claimFromLetter(parseLetter(corpusText("Versandhandel: Rechnung")));
    const inkasso = parseLetter(corpusText("Inkasso: Erstschreiben mit Gläubiger-Zeile"));
    claim = applyLetterToClaim(claim, inkasso);

    expect(claim.creditor).toBe("Cura Inkasso GmbH");
    expect(claim.original_creditor).toBe("Nordwind Versand GmbH");
    expect(claim.iban).toBe("DE02100500000054540402"); // Zahlstelle = Inkasso-Konto
    expect(claim.current_amount).toBe(63.0);
    expect(claim.aktenzeichen).toBe("IK-2026-0815");
  });
});

describe("Stapel-Gruppierung („23 Briefe → 7 Forderungen“)", () => {
  it("führt die komplette Nordwind-Kette zu EINER Akte zusammen", () => {
    const result = groupLettersIntoClaims(NORDWIND_CHAIN.map(parseLetter));
    expect(result.letterCount).toBe(6);
    expect(result.claimCount).toBe(1);
    expect(result.summary).toContain("Aus deinen 6 Briefen wurde 1 Forderung");

    const claim = result.claims[0];
    expect(claim.timeline.length).toBe(6);
    expect(claim.current_amount).toBe(87.0);
  });

  it("Reihenfolge und Duplikate im Stapel sind egal", () => {
    const shuffled = [...NORDWIND_CHAIN].reverse();
    const withDuplicates = [...shuffled, NORDWIND_CHAIN[2], NORDWIND_CHAIN[0]];
    const result = groupLettersIntoClaims(withDuplicates.map(parseLetter));

    expect(result.claimCount).toBe(1);
    // Duplikate erzeugen keine zusätzlichen Timeline-Einträge
    expect(result.claims[0].timeline.length).toBe(6);
    // Jüngster Brief bestimmt den Betrag — unabhängig von der Scan-Reihenfolge
    expect(result.claims[0].current_amount).toBe(87.0);
  });

  it("trennt verschiedene Gläubiger in eigene Akten", () => {
    const letters = [
      ...NORDWIND_CHAIN,
      corpusText("Telekommunikation: Rechnung"),
      corpusText("Telekommunikation: 1. Mahnung"),
      corpusText("Energie: Rechnung Stadtwerke"),
    ].map(parseLetter);
    const result = groupLettersIntoClaims(letters);
    expect(result.claimCount).toBe(3);
    expect(result.summary).toContain("Aus deinen 9 Briefen wurden 3 Forderungen");
  });

  it("Stufe-3-Matches landen in der Review-Liste", () => {
    const letters = [
      corpusText("Versandhandel: Rechnung"),
      `Nordwind Versand GmbH\n\nMahnung\nGesamtbetrag: 52,40 €`,
    ].map(parseLetter);
    const result = groupLettersIntoClaims(letters);
    expect(result.claimCount).toBe(1);
    expect(result.needsReview.length).toBe(1);
  });
});

describe("Timeline & Gebühren-Eskalation", () => {
  it("sortiert die Timeline chronologisch und zeigt die Eskalation", () => {
    const result = groupLettersIntoClaims([...NORDWIND_CHAIN].reverse().map(parseLetter));
    const claim = result.claims[0];
    const types = claim.timeline.map((e) => e.doc_type);
    expect(types).toEqual([
      "rechnung",
      "zahlungserinnerung",
      "mahnung_1",
      "mahnung_2_plus",
      "inkasso",
      "inkasso",
    ]);

    const esc = feeEscalation(claim);
    expect(esc?.first).toBe(49.9);
    expect(esc?.current).toBe(87.0);
    expect(esc?.message).toContain("Jeder Monat früher spart Gebühren");
  });

  it("keine Eskalations-Botschaft bei nur einem Brief", () => {
    const claim = claimFromLetter(parseLetter(corpusText("Versandhandel: Rechnung")));
    expect(feeEscalation(claim)).toBeNull();
  });
});

describe("Schutzfunktionen & Status", () => {
  it("Doppelzahlungs-Schutz: bezahlte Akte warnt bei erneuter Zahlungsvorbereitung", () => {
    const claim = claimFromLetter(parseLetter(corpusText("Versandhandel: Rechnung")));
    expect(doublePaymentWarning(claim)).toBeNull();
    const paid: Claim = { ...claim, status: "bezahlt" };
    expect(doublePaymentWarning(paid)).toContain("Doppelzahlung");
  });

  it("gerichtlicher Mahnbescheid eskaliert die Akte", () => {
    const bescheid = parseLetter(corpusText("Gerichtlicher Mahnbescheid"));
    expect(claimFromLetter(bescheid).status).toBe("eskaliert");

    let claim = claimFromLetter(parseLetter(corpusText("Versandhandel: Rechnung")));
    claim = applyLetterToClaim(claim, bescheid);
    expect(claim.status).toBe("eskaliert");
  });
});
