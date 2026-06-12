import { describe, expect, it } from "vitest";
import type { Transaction } from "../../types";
import {
  claimGuidance,
  COUNSELING_SERVICES,
  counselingRecommendation,
  ibanChangeWarning,
  inkassoRegisterHint,
  matchPaymentsToClaims,
  RDG_REGISTER_URL,
} from "../debt-guardrails-service";
import { applyLetterToClaim, claimFromLetter, type Claim } from "../claim-service";
import { girocodeForClaim } from "../girocode-service";
import { parseLetter } from "../letter-parser-service";
import { LETTER_CORPUS } from "./letter-parser-corpus";

function corpusText(name: string): string {
  return LETTER_CORPUS.find((l) => l.name === name)!.text;
}

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? crypto.randomUUID(),
    date: "2026-06-01",
    amount: -10,
    payee: "",
    description: "",
    original_text: "",
    auto_mapped: false,
    confirmed: true,
    ...partial,
  };
}

describe("Mahnbescheid-Eskalation", () => {
  it("wechselt den Flow: keine Zahlungs-Aktion, Vermittlung zur Schuldnerberatung", () => {
    const claim = claimFromLetter(parseLetter(corpusText("Gerichtlicher Mahnbescheid")));
    const guidance = claimGuidance(claim);
    expect(guidance.kind).toBe("mahnbescheid");
    expect(guidance.allowPaymentAction).toBe(false);
    expect(guidance.message).toContain("14-Tage-Frist");
    expect(guidance.message).toContain("Schuldnerberatung");
    expect(guidance.counseling).toEqual(COUNSELING_SERVICES);
  });

  it("Mahnbescheid-Pfad zeigt nie einen GiroCode", () => {
    let claim = claimFromLetter(parseLetter(corpusText("Versandhandel: Rechnung")));
    claim = { ...claim, status: "bestaetigt" };
    claim = applyLetterToClaim(claim, parseLetter(corpusText("Gerichtlicher Mahnbescheid")));
    expect(claimGuidance(claim).allowPaymentAction).toBe(false);
    expect(() => girocodeForClaim(claim)).toThrow(/Schuldnerberatung/);
  });

  it("normale bestätigte Akte erlaubt die Zahlungs-Aktion", () => {
    const claim: Claim = {
      ...claimFromLetter(parseLetter(corpusText("Versandhandel: Rechnung"))),
      status: "bestaetigt",
    };
    const guidance = claimGuidance(claim);
    expect(guidance.kind).toBe("normal");
    expect(guidance.allowPaymentAction).toBe(true);
  });
});

describe("Schuldnerberatungs-Brücke", () => {
  it("verweist nur auf anerkannte, kostenlose Stellen mit funktionierenden Links", () => {
    for (const service of COUNSELING_SERVICES) {
      expect(service.url).toMatch(/^https:\/\/www\.(caritas|diakonie|verbraucherzentrale)\.de/);
      expect(service.note.toLowerCase()).toContain("kostenlos");
    }
  });

  it("empfiehlt Beratung bei Plandauer über 6 Jahren", () => {
    const rec = counselingRecommendation({ monthlyRate: 200, availableIncome: 300, planMonths: 90 });
    expect(rec.recommended).toBe(true);
    expect(rec.reason).toContain("6 Jahre");
    expect(rec.warning).toContain("Schuldenregulierern");
  });

  it("empfiehlt Beratung, wenn Raten das verfügbare Einkommen übersteigen", () => {
    const rec = counselingRecommendation({ monthlyRate: 400, availableIncome: 250, planMonths: 24 });
    expect(rec.recommended).toBe(true);
    expect(rec.reason).toContain("kostenlos");
  });

  it("empfiehlt Beratung, wenn der Plan nie aufgeht", () => {
    const rec = counselingRecommendation({ monthlyRate: 50, availableIncome: 100, planMonths: null });
    expect(rec.recommended).toBe(true);
  });

  it("keine Empfehlung bei tragfähigem Plan", () => {
    const rec = counselingRecommendation({ monthlyRate: 250, availableIncome: 400, planMonths: 19 });
    expect(rec.recommended).toBe(false);
    expect(rec.reason).toBeNull();
  });
});

describe("Betrugs-/Fehler-Schutz", () => {
  it("Inkasso-Akten erhalten den Hinweis aufs Rechtsdienstleistungsregister", () => {
    let claim = claimFromLetter(parseLetter(corpusText("Versandhandel: Rechnung")));
    claim = applyLetterToClaim(
      claim,
      parseLetter(corpusText("Inkasso: Erstschreiben mit Gläubiger-Zeile")),
    );
    const hint = inkassoRegisterHint(claim);
    expect(hint).toContain("Cura Inkasso GmbH");
    expect(hint).toContain(RDG_REGISTER_URL);
  });

  it("Akten ohne Inkasso bekommen keinen Register-Hinweis", () => {
    const claim = claimFromLetter(parseLetter(corpusText("Versandhandel: Rechnung")));
    expect(inkassoRegisterHint(claim)).toBeNull();
  });

  it("IBAN-Wechsel ohne Inkasso-Übergang erzeugt eine Warnung", () => {
    let claim = claimFromLetter(parseLetter(corpusText("Versandhandel: Rechnung")));
    const fake = parseLetter(`Nordwind Versand GmbH

2. Mahnung
Rechnungsnummer: RG-2026-04711
Gesamtbetrag: 58,00 €
IBAN: DE02 1203 0000 0000 2020 51`);
    claim = applyLetterToClaim(claim, fake);
    const warning = ibanChangeWarning(claim);
    expect(warning).toContain("Empfänger-IBAN");
    expect(warning).toContain("Betrugsversuch");
  });

  it("Wechsel zur Inkasso-Zahlstelle ist erklärbar und warnt nicht", () => {
    let claim = claimFromLetter(parseLetter(corpusText("Versandhandel: Rechnung")));
    claim = applyLetterToClaim(
      claim,
      parseLetter(corpusText("Inkasso: Erstschreiben mit Gläubiger-Zeile")),
    );
    expect(ibanChangeWarning(claim)).toBeNull();
  });

  it("gleichbleibende IBAN warnt nicht", () => {
    let claim = claimFromLetter(parseLetter(corpusText("Versandhandel: Rechnung")));
    claim = applyLetterToClaim(claim, parseLetter(corpusText("Versandhandel: 1. Mahnung")));
    expect(ibanChangeWarning(claim)).toBeNull();
  });
});

describe("Zahlungsabgleich (Doppelzahlungs-Schutz andersherum)", () => {
  function confirmedClaim(): Claim {
    return {
      ...claimFromLetter(parseLetter(corpusText("Versandhandel: Rechnung"))),
      status: "bestaetigt",
    };
  }

  it("matcht ausgehende Zahlung über den Verwendungszweck und markiert die Akte", () => {
    const claim = confirmedClaim();
    const payment = tx({
      id: "tx-1",
      amount: -49.9,
      payee: "NORDWIND VERSAND",
      description: "RG-2026-04711",
    });
    const matches = matchPaymentsToClaims([payment], [claim]);
    expect(matches).toEqual([
      { claimId: claim.id, transactionId: "tx-1", duplicate: false, warning: null },
    ]);
  });

  it("matcht über Betrag + Empfänger, wenn keine Referenz im Umsatz steht", () => {
    const claim = confirmedClaim();
    const payment = tx({ id: "tx-2", amount: -49.9, payee: "Nordwind Versand GmbH" });
    expect(matchPaymentsToClaims([payment], [claim])[0]?.claimId).toBe(claim.id);
  });

  it("warnt bei zweiter Zahlung auf dieselbe Akte", () => {
    const claim = confirmedClaim();
    const first = tx({ id: "tx-1", date: "2026-06-01", amount: -49.9, description: "RG-2026-04711" });
    const second = tx({ id: "tx-2", date: "2026-06-05", amount: -49.9, description: "RG-2026-04711" });
    const matches = matchPaymentsToClaims([first, second], [claim]);
    expect(matches.length).toBe(2);
    expect(matches[0].duplicate).toBe(false);
    expect(matches[1].duplicate).toBe(true);
    expect(matches[1].warning).toContain("Doppelzahlung");
  });

  it("ignoriert Eingänge und fremde Zahlungen", () => {
    const claim = confirmedClaim();
    const incoming = tx({ id: "tx-3", amount: 49.9, description: "RG-2026-04711" });
    const unrelated = tx({ id: "tx-4", amount: -12.5, payee: "Supermarkt", description: "Einkauf" });
    expect(matchPaymentsToClaims([incoming, unrelated], [claim])).toEqual([]);
  });

  it("warnt sofort, wenn die Akte bereits als bezahlt markiert ist", () => {
    const claim: Claim = { ...confirmedClaim(), status: "bezahlt" };
    const payment = tx({ id: "tx-5", amount: -49.9, description: "RG-2026-04711" });
    const matches = matchPaymentsToClaims([payment], [claim]);
    expect(matches[0].duplicate).toBe(true);
  });
});
