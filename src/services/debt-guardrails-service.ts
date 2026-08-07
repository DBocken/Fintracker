// Schulden-Guardrails (Issue #50, Epic #24): Mahnbescheid-Eskalation,
// Betrugs-/Fehler-Schutz und Zahlungsabgleich. Die Schuldnerberatungs-Brücke
// und die Überschuldungs-Heuristik sind rein und liegen in
// `lib/debt-counseling-guardrails.ts`.
//
// RDG-Grenze (Formulierungsdisziplin, siehe docs/RDG_TEXTREGELN.md):
// Die App informiert, strukturiert und motiviert — sie berät nicht rechtlich.
// Alle Texte hier sind gegen die Regeln in docs/RDG_TEXTREGELN.md geprüft.

import { t } from "../i18n/serviceT";
import type { Transaction } from "../types";
import { creditorKey, similarReference, type Claim } from "./claim-service";
import { getCounselingServices, type CounselingService } from "@/lib/debt-counseling-guardrails";

// -----------------------------------------------------------------------------
// 1. Mahnbescheid-Eskalation
// -----------------------------------------------------------------------------

export type ClaimGuidanceKind = "mahnbescheid" | "normal";

export interface ClaimGuidance {
  kind: ClaimGuidanceKind;
  /** Bei „mahnbescheid": KEINE Zahlungs-Mikro-Aktion anbieten. */
  allowPaymentAction: boolean;
  message: string;
  counseling: CounselingService[] | null;
}

/**
 * Erkennt der Parser einen gerichtlichen Mahnbescheid, wechselt der Flow:
 * keine Zahlungs-Mikro-Aktion, sondern Vermittlung zur Schuldnerberatung.
 * (girocode-service verweigert für eskalierte Akten zusätzlich jeden QR.)
 */
export function claimGuidance(claim: Claim): ClaimGuidance {
  const hasMahnbescheid =
    claim.status === "eskaliert" ||
    claim.timeline.some((e) => e.doc_type === "mahnbescheid");
  if (hasMahnbescheid) {
    return {
      kind: "mahnbescheid",
      allowPaymentAction: false,
      message: t('debts.guardrails.mahnbescheidMessage'),
      counseling: getCounselingServices(),
    };
  }
  return {
    kind: "normal",
    allowPaymentAction: claim.status === "bestaetigt",
    message: t('debts.guardrails.normalClaimMessage'),
    counseling: null,
  };
}

// -----------------------------------------------------------------------------
// 4. Betrugs-/Fehler-Schutz
// -----------------------------------------------------------------------------

export const RDG_REGISTER_URL = "https://www.rechtsdienstleistungsregister.de";

/**
 * Hinweis bei Inkasso-Forderungen: Seriöse Inkassounternehmen sind im
 * Rechtsdienstleistungsregister eingetragen. (Information, keine Bewertung.)
 */
export function inkassoRegisterHint(claim: Claim): string | null {
  const isInkasso =
    claim.original_creditor != null ||
    claim.timeline.some((e) => e.doc_type === 'inkasso');
  if (!isInkasso) return null;
  return t('debts.guardrails.inkassoHint', 'Inkassounternehmen muessen im Rechtsdienstleistungsregister eingetragen sein. Du kannst \”{creditor}\” dort kostenlos nachschlagen: {url}')
    .replace('{creditor}', claim.creditor)
    .replace('{url}', RDG_REGISTER_URL);
}

/**
 * IBAN-Wechsel innerhalb einer Akte erzeugt eine Warnung — außer beim
 * erklärbaren Wechsel zur Inkasso-Zahlstelle.
 */
export function ibanChangeWarning(claim: Claim): string | null {
  const entriesWithIban = claim.timeline.filter((e) => e.iban != null);
  for (let i = 1; i < entriesWithIban.length; i++) {
    const prev = entriesWithIban[i - 1];
    const curr = entriesWithIban[i];
    if (prev.iban === curr.iban) continue;
    const explainedByInkasso =
      curr.doc_type === "inkasso" && prev.doc_type !== "inkasso";
    if (!explainedByInkasso) {
      const msg = t('debts.guardrails.ibanWarning', 'Achtung: Die Empfaenger-IBAN in dieser Akte hat sich geaendert ({oldIban} -> {newIban}), ohne dass ein Inkasso-Uebergang erkennbar ist. Das kann ein Fehler sein - oder ein Betrugsversuch. Zahle erst, wenn du den Wechsel geklaert hast.');
      return msg.replace('{oldIban}', prev.iban ?? '').replace('{newIban}', curr.iban ?? '');
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// 5. Doppelzahlungs-Schutz andersherum: Zahlungsabgleich (Login-Tier)
// -----------------------------------------------------------------------------

export interface PaymentMatch {
  claimId: string;
  transactionId: string;
  /** Zweite Zahlung auf dieselbe Akte → Warnung statt stiller Verbuchung. */
  duplicate: boolean;
  warning: string | null;
}

function transactionText(tx: Transaction): string {
  return [tx.payee, tx.description, tx.original_text].filter(Boolean).join(" ");
}

function matchesClaim(tx: Transaction, claim: Claim): boolean {
  if (tx.amount >= 0) return false; // nur ausgehende Zahlungen
  const text = transactionText(tx);
  const refMatch = [claim.verwendungszweck, claim.aktenzeichen, claim.rechnungsnummer]
    .filter((r): r is string => !!r)
    .some((r) => similarReference(r, text));
  if (refMatch) return true;
  const amountMatch = Math.abs(Math.abs(tx.amount) - claim.current_amount) < 0.01;
  const creditorMatch =
    creditorKey(tx.payee) !== "" && creditorKey(tx.payee) === creditorKey(claim.creditor);
  return amountMatch && creditorMatch;
}

/**
 * Gleicht ausgehende Zahlungen gegen Akten-Referenzen/Empfänger ab.
 * Erste Zahlung → Akte kann automatisch „bezahlt" werden; jede weitere
 * Zahlung auf dieselbe Akte erzeugt eine Doppelzahlungs-Warnung.
 */
export function matchPaymentsToClaims(
  transactions: Transaction[],
  claims: Claim[],
): PaymentMatch[] {
  const matches: PaymentMatch[] = [];
  const paidClaimIds = new Set(
    claims.filter((c) => c.status === "bezahlt").map((c) => c.id),
  );

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const tx of sorted) {
    if (!tx.id) continue;
    for (const claim of claims) {
      if (!matchesClaim(tx, claim)) continue;
      const duplicate = paidClaimIds.has(claim.id);
      matches.push({
        claimId: claim.id,
        transactionId: tx.id,
        duplicate,
        warning: duplicate
          ? t('debts.guardrails.duplicatePaymentWarning', 'Mögliche Doppelzahlung: Auf die Forderung von {creditor} wurde bereits gezahlt. Prüfe die Umsätze, bevor du erneut überweist — zu viel Gezahltes kannst du zurückfordern.').replace('{creditor}', claim.creditor)
          : null,
      });
      if (!duplicate) paidClaimIds.add(claim.id);
      break; // eine Transaktion gehört zu höchstens einer Akte
    }
  }
  return matches;
}
