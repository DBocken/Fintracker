import { describe, expect, it } from "vitest";
import {
  applyPaymentToClaim,
  buildEpcPayload,
  EPC_MAX_REMITTANCE_LENGTH,
  formatEpcAmount,
  girocodeForClaim,
} from "../girocode-service";
import { claimFromLetter, type Claim } from "../claim-service";
import { parseLetter } from "../letter-parser-service";
import { LETTER_CORPUS } from "./letter-parser-corpus";

const VALID_IBAN = "DE89370400440532013000";

function confirmedClaim(overrides: Partial<Claim> = {}): Claim {
  const text = LETTER_CORPUS.find((l) => l.name === "Versandhandel: Rechnung")!.text;
  return { ...claimFromLetter(parseLetter(text)), status: "bestaetigt", ...overrides };
}

describe("buildEpcPayload (EPC069-12)", () => {
  it("erzeugt einen spezifikationskonformen Payload", () => {
    const payload = buildEpcPayload({
      name: "Nordwind Versand GmbH",
      iban: "DE89 3704 0044 0532 0130 00",
      amount: 52.4,
      remittance: "RG-2026-04711",
    });
    expect(payload.split("\n")).toEqual([
      "BCD",
      "002",
      "1",
      "SCT",
      "", // BIC optional
      "Nordwind Versand GmbH",
      VALID_IBAN,
      "EUR52.40",
      "", // Purpose
      "", // Strukturierte Referenz
      "RG-2026-04711",
    ]);
  });

  it("lässt Trailing-Leerfelder ohne Verwendungszweck entfallen", () => {
    const payload = buildEpcPayload({ name: "Test AG", iban: VALID_IBAN, amount: 10 });
    const lines = payload.split("\n");
    expect(lines[lines.length - 1]).toBe("EUR10.00");
    expect(lines.length).toBe(8);
  });

  it("erhält Umlaute (Zeichensatz UTF-8)", () => {
    const payload = buildEpcPayload({
      name: "Bäckerei Müller & Söhne GmbH",
      iban: VALID_IBAN,
      amount: 5,
      remittance: "Brötchen-Rückstände März",
    });
    expect(payload).toContain("Bäckerei Müller & Söhne GmbH");
    expect(payload).toContain("Brötchen-Rückstände März");
  });

  it("kürzt Verwendungszweck auf 140 und Name auf 70 Zeichen", () => {
    const payload = buildEpcPayload({
      name: "X".repeat(100),
      iban: VALID_IBAN,
      amount: 1,
      remittance: "Z".repeat(200),
    });
    const lines = payload.split("\n");
    expect(lines[5].length).toBe(70);
    expect(lines[10].length).toBe(EPC_MAX_REMITTANCE_LENGTH);
  });

  it("entfernt Zeilenumbrüche aus Feldwerten (Feldtrenner-Schutz)", () => {
    const payload = buildEpcPayload({
      name: "Evil\nCorp",
      iban: VALID_IBAN,
      amount: 1,
      remittance: "Zeile1\r\nZeile2",
    });
    const lines = payload.split("\n");
    expect(lines[5]).toBe("Evil Corp");
    expect(lines[10]).toBe("Zeile1 Zeile2");
  });

  it("formatiert Beträge mit Punkt und zwei Nachkommastellen", () => {
    expect(formatEpcAmount(1234.5)).toBe("EUR1234.50");
    expect(formatEpcAmount(0.01)).toBe("EUR0.01");
    expect(formatEpcAmount(213)).toBe("EUR213.00");
  });

  it("weist ungültige IBANs (Mod-97) ab", () => {
    expect(() =>
      buildEpcPayload({ name: "Test", iban: "DE89370400440532013001", amount: 1 }),
    ).toThrow(/Ungültige IBAN/);
  });

  it("weist Beträge außerhalb des EPC-Bereichs ab", () => {
    expect(() => buildEpcPayload({ name: "Test", iban: VALID_IBAN, amount: 0 })).toThrow();
    expect(() =>
      buildEpcPayload({ name: "Test", iban: VALID_IBAN, amount: 1_000_000_000 }),
    ).toThrow();
  });
});

describe("girocodeForClaim (Guardrails)", () => {
  it("erzeugt für eine bestätigte Akte QR-Payload, Abtipp-Daten und Mikro-Aktion", () => {
    const result = girocodeForClaim(confirmedClaim());
    expect(result.payload).toContain("EUR49.90");
    expect(result.display.iban).toBe(VALID_IBAN);
    expect(result.warning).toBeNull();
    expect(result.remainingAfterPayment).toBe(0);
    expect(result.microAction).toBe(
      "Überweise 49,90 € an Nordwind Versand GmbH — mehr musst du heute nicht tun.",
    );
  });

  it("verweigert unbestätigte Forderungen (Schutz vor Fake-Mahnungen)", () => {
    const claim = { ...confirmedClaim(), status: "offen" as const };
    expect(() => girocodeForClaim(claim)).toThrow(/noch nicht bestätigt/);
  });

  it("Mahnbescheid-Pfad zeigt nie einen GiroCode", () => {
    const claim = { ...confirmedClaim(), status: "eskaliert" as const };
    expect(() => girocodeForClaim(claim)).toThrow(/Schuldnerberatung/);
  });

  it("warnt bei bereits bezahlter Akte (Doppelzahlungs-Schutz)", () => {
    const claim = { ...confirmedClaim(), status: "bezahlt" as const };
    const result = girocodeForClaim(claim, 10);
    expect(result.warning).toContain("Doppelzahlung");
  });

  it("unterstützt Teilzahlungen und führt den Restbetrag", () => {
    const claim = confirmedClaim();
    const result = girocodeForClaim(claim, 20);
    expect(result.payload).toContain("EUR20.00");
    expect(result.remainingAfterPayment).toBe(29.9);
    expect(() => girocodeForClaim(claim, 100)).toThrow(/über dem offenen Restbetrag/);
  });

  it("nutzt Verwendungszweck bzw. Aktenzeichen als Referenz", () => {
    const result = girocodeForClaim(confirmedClaim());
    expect(result.display.remittance).toBe("RG-2026-04711");
  });
});

describe("applyPaymentToClaim", () => {
  it("reduziert den Restbetrag bei Teilzahlung", () => {
    const claim = applyPaymentToClaim(confirmedClaim(), 20);
    expect(claim.current_amount).toBe(29.9);
    expect(claim.status).toBe("bestaetigt");
  });

  it("markiert die Akte bei vollständiger Zahlung als bezahlt", () => {
    const claim = applyPaymentToClaim(confirmedClaim(), 49.9);
    expect(claim.current_amount).toBe(0);
    expect(claim.status).toBe("bezahlt");
    expect(() => {
      const r = girocodeForClaim(claim, 1);
      if (r.warning) throw new Error(r.warning);
    }).toThrow(/Doppelzahlung|Restbetrag/);
  });
});
