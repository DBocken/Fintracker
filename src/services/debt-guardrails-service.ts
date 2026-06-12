// Schulden-Guardrails (Issue #50, Epic #24): Mahnbescheid-Eskalation,
// Schuldnerberatungs-Brücke, Betrugs-/Fehler-Schutz und Zahlungsabgleich.
//
// RDG-Grenze (Formulierungsdisziplin, siehe docs/RDG_TEXTREGELN.md):
// Die App informiert, strukturiert und motiviert — sie berät nicht rechtlich.
// Alle Texte hier sind gegen die Regeln in docs/RDG_TEXTREGELN.md geprüft.

import type { Transaction } from "../types";
import { creditorKey, similarReference, type Claim } from "./claim-service";

// -----------------------------------------------------------------------------
// Schuldnerberatungs-Brücke: anerkannte, KOSTENLOSE Stellen
// -----------------------------------------------------------------------------

export interface CounselingService {
  name: string;
  url: string;
  note: string;
}

export const COUNSELING_SERVICES: CounselingService[] = [
  {
    name: "Caritas Schuldnerberatung",
    url: "https://www.caritas.de/onlineberatung/schuldnerberatung",
    note: "Kostenlos, auch online und anonym.",
  },
  {
    name: "Diakonie Schuldnerberatung",
    url: "https://www.diakonie.de/schuldnerberatung",
    note: "Kostenlos, bundesweit.",
  },
  {
    name: "Verbraucherzentrale",
    url: "https://www.verbraucherzentrale.de/beratung",
    note: "Schuldner- und Insolvenzberatung, je nach Bundesland kostenlos.",
  },
];

export const COMMERCIAL_REGULATOR_WARNING =
  "Vorsicht bei kommerziellen „Schuldenregulierern“: Sie verlangen Gebühren für etwas, das anerkannte Beratungsstellen kostenlos leisten. Die Stellen oben sind kostenlos.";

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
      message:
        "Das ist ein gerichtlicher Mahnbescheid mit 14-Tage-Frist. Hier hilft dir eine Schuldnerberatung sofort und kostenlos.",
      counseling: COUNSELING_SERVICES,
    };
  }
  return {
    kind: "normal",
    allowPaymentAction: claim.status === "bestaetigt",
    message: "Eingeordnet in deinen Plan.",
    counseling: null,
  };
}

// -----------------------------------------------------------------------------
// 2. Überschuldungs-Erkennung → aktiver Beratungs-Verweis
// -----------------------------------------------------------------------------

/** Tilgungsplan länger als 6 Jahre = Dauer einer Restschuldbefreiung. */
export const OVERINDEBTEDNESS_PLAN_MONTHS = 72;

export interface OverindebtednessInput {
  /** Geplante monatliche Tilgungsrate über alle Schulden. */
  monthlyRate: number;
  /** Monatlich verfügbares Einkommen (nach Fixkosten). */
  availableIncome: number;
  /** Berechnete Plandauer in Monaten (null = Plan geht nie auf). */
  planMonths: number | null;
}

export interface CounselingRecommendation {
  recommended: boolean;
  reason: string | null;
  services: CounselingService[];
  warning: string;
}

export function counselingRecommendation(
  input: OverindebtednessInput,
): CounselingRecommendation {
  let reason: string | null = null;
  if (input.planMonths === null) {
    reason =
      "Mit den aktuellen Raten geht dein Plan nicht auf. Das ist lösbar — aber nicht allein mit einer App.";
  } else if (input.planMonths > OVERINDEBTEDNESS_PLAN_MONTHS) {
    reason = `Dein Plan dauert länger als ${OVERINDEBTEDNESS_PLAN_MONTHS / 12} Jahre. Eine Schuldnerberatung kennt Wege, die schneller zum Ziel führen können.`;
  } else if (input.monthlyRate > input.availableIncome) {
    reason =
      "Die geplanten Raten liegen über dem, was dir monatlich bleibt. Eine Schuldnerberatung hilft kostenlos, das neu zu ordnen.";
  }

  return {
    recommended: reason !== null,
    reason,
    services: COUNSELING_SERVICES,
    warning: COMMERCIAL_REGULATOR_WARNING,
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
    claim.timeline.some((e) => e.doc_type === "inkasso");
  if (!isInkasso) return null;
  return `Inkassounternehmen müssen im Rechtsdienstleistungsregister eingetragen sein. Du kannst „${claim.creditor}“ dort kostenlos nachschlagen: ${RDG_REGISTER_URL}`;
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
      return `Achtung: Die Empfänger-IBAN in dieser Akte hat sich geändert (${prev.iban} → ${curr.iban}), ohne dass ein Inkasso-Übergang erkennbar ist. Das kann ein Fehler sein — oder ein Betrugsversuch. Zahle erst, wenn du den Wechsel geklärt hast.`;
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
          ? `Mögliche Doppelzahlung: Auf die Forderung von ${claim.creditor} wurde bereits gezahlt. Prüfe die Umsätze, bevor du erneut überweist — zu viel Gezahltes kannst du zurückfordern.`
          : null,
      });
      if (!duplicate) paidClaimIds.add(claim.id);
      break; // eine Transaktion gehört zu höchstens einer Akte
    }
  }
  return matches;
}
