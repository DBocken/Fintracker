// GiroCode-Generator: Überweisung per EPC-QR-Code vorbereiten (Issue #47, Epic #24).
//
// Bewusste Architektur-Entscheidung: KEINE Zahlungsauslösung (PIS) — nur ein
// EPC069-12-QR-Code („GiroCode"), den die Banking-App des Nutzers scannt.
// Guardrail aus Epic #24: Ein QR-Code entsteht erst, nachdem der Nutzer die
// Forderung bestätigt hat (Schutz vor Fake-Mahnungen); für gerichtliche
// Mahnbescheide (Status „eskaliert") wird NIE ein GiroCode erzeugt (#50).

import { isValidIban } from "./letter-parser-service";
import { doublePaymentWarning, type Claim } from "./claim-service";

// -----------------------------------------------------------------------------
// EPC069-12-Payload (Service Tag BCD, Version 002, SCT)
// -----------------------------------------------------------------------------

export interface EpcPaymentData {
  /** Empfängername (max. 70 Zeichen, wird gekürzt). */
  name: string;
  iban: string;
  /** Betrag in Euro, 0,01 bis 999.999.999,99. */
  amount: number;
  /** Unstrukturierter Verwendungszweck (max. 140 Zeichen, wird gekürzt). */
  remittance?: string;
  /** BIC — seit SEPA-Raum-Vollendung optional. */
  bic?: string;
}

export const EPC_MAX_NAME_LENGTH = 70;
export const EPC_MAX_REMITTANCE_LENGTH = 140;
export const EPC_MIN_AMOUNT = 0.01;
export const EPC_MAX_AMOUNT = 999_999_999.99;

function sanitizeLine(value: string, maxLength: number): string {
  // Zeilenumbrüche trennen im EPC-Format Felder — niemals in Feldwerten zulassen.
  const flat = value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  return flat.length > maxLength ? flat.slice(0, maxLength).trimEnd() : flat;
}

/** Betrag im EPC-Format: Punkt-Dezimaltrennzeichen, exakt 2 Nachkommastellen. */
export function formatEpcAmount(amount: number): string {
  return `EUR${amount.toFixed(2)}`;
}

/**
 * Baut den EPC069-12-Payload. Wirft bei ungültiger IBAN (Mod-97), leerem
 * Empfängernamen oder Betrag außerhalb des erlaubten Bereichs.
 */
export function buildEpcPayload(data: EpcPaymentData): string {
  const iban = data.iban.replace(/\s+/g, "").toUpperCase();
  if (!isValidIban(iban)) {
    throw new Error(`Ungültige IBAN: ${data.iban}`);
  }

  const name = sanitizeLine(data.name, EPC_MAX_NAME_LENGTH);
  if (!name) {
    throw new Error("Empfängername fehlt.");
  }

  const cents = Math.round(data.amount * 100);
  const amount = cents / 100;
  if (!Number.isFinite(amount) || amount < EPC_MIN_AMOUNT || amount > EPC_MAX_AMOUNT) {
    throw new Error(`Betrag außerhalb des erlaubten Bereichs: ${data.amount}`);
  }

  const remittance = sanitizeLine(data.remittance ?? "", EPC_MAX_REMITTANCE_LENGTH);
  const bic = data.bic ? sanitizeLine(data.bic, 11).toUpperCase() : "";

  // Feldreihenfolge laut Spezifikation; Zeichensatz 1 = UTF-8 (Umlaute erlaubt).
  // Leeres Feld 9 (strukturierte Referenz), da Feld 10 (unstrukturiert) genutzt wird.
  const lines = [
    "BCD",
    "002",
    "1",
    "SCT",
    bic,
    name,
    iban,
    formatEpcAmount(amount),
    "", // Purpose-Code
    "", // Strukturierte Referenz (ISO 11649)
    remittance,
  ];

  // Trailing-Leerelemente dürfen entfallen.
  while (lines.length > 8 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

// -----------------------------------------------------------------------------
// GiroCode aus einer Forderungsakte
// -----------------------------------------------------------------------------

export interface GirocodeResult {
  payload: string;
  /** Daten zum Abtippen als Fallback. */
  display: { name: string; iban: string; amount: number; remittance: string };
  /** Z. B. Doppelzahlungs-Hinweis — UI muss diesen prominent zeigen. */
  warning: string | null;
  /** Restbetrag der Akte nach dieser (Teil-)Zahlung. */
  remainingAfterPayment: number;
  /** Coach-Mikro-Aktion: „Überweise 213 € an … — mehr musst du heute nicht tun." */
  microAction: string;
}

function formatEuro(amount: number): string {
  return amount.toLocaleString("de-DE", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Bereitet die Überweisung für eine BESTÄTIGTE Forderungsakte vor.
 * `amount` erlaubt Teilzahlungen (Standard: voller Restbetrag).
 */
export function girocodeForClaim(claim: Claim, amount?: number): GirocodeResult {
  if (claim.status === "offen") {
    throw new Error(
      "Diese Forderung ist noch nicht bestätigt. Bitte prüfe erst, ob sie berechtigt ist — dann bereiten wir die Überweisung vor.",
    );
  }
  if (claim.status === "eskaliert") {
    // Mahnbescheid-Pfad zeigt nie einen GiroCode (Guardrail #50).
    throw new Error(
      "Für einen gerichtlichen Mahnbescheid bereiten wir keine Zahlung vor. Hier hilft dir eine Schuldnerberatung sofort und kostenlos.",
    );
  }
  if (!claim.iban) {
    throw new Error("Für diese Akte ist keine gültige Empfänger-IBAN bekannt.");
  }

  const payAmount = amount ?? claim.current_amount;
  if (payAmount > claim.current_amount) {
    throw new Error("Der Betrag liegt über dem offenen Restbetrag der Akte.");
  }

  const remittance =
    claim.verwendungszweck ?? claim.aktenzeichen ?? claim.rechnungsnummer ?? "";
  const payload = buildEpcPayload({
    name: claim.creditor,
    iban: claim.iban,
    amount: payAmount,
    remittance,
  });

  return {
    payload,
    display: {
      name: sanitizeLine(claim.creditor, EPC_MAX_NAME_LENGTH),
      iban: claim.iban,
      amount: Math.round(payAmount * 100) / 100,
      remittance: sanitizeLine(remittance, EPC_MAX_REMITTANCE_LENGTH),
    },
    warning: doublePaymentWarning(claim),
    remainingAfterPayment: Math.max(0, Math.round((claim.current_amount - payAmount) * 100) / 100),
    microAction: `Überweise ${formatEuro(payAmount)} € an ${claim.creditor} — mehr musst du heute nicht tun.`,
  };
}

/**
 * (Teil-)Zahlung in der Akte verbuchen (pur): Restbetrag sinkt, bei 0 wird die
 * Akte „bezahlt" — danach greift der Doppelzahlungs-Schutz.
 */
export function applyPaymentToClaim(claim: Claim, amount: number): Claim {
  const remaining = Math.max(0, Math.round((claim.current_amount - amount) * 100) / 100);
  return {
    ...claim,
    current_amount: remaining,
    status: remaining === 0 ? "bezahlt" : claim.status,
    updated_at: new Date().toISOString(),
  };
}

// -----------------------------------------------------------------------------
// QR-Rendering (lokal, lazy geladen)
// -----------------------------------------------------------------------------

/** Rendert den Payload als QR-Data-URL. Fehlerkorrektur M laut EPC-Vorgabe. */
export async function renderGirocodeDataUrl(payload: string): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 2, scale: 6 });
}
