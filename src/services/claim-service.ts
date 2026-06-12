// Forderungsakten: Matching/Dedup inkl. Inkasso-Übergabe + Mahnstufen-Timeline
// (Issue #46, Epic #24). Herzstück: mehrere Briefe = EINE Forderung.
//
// Die Matching- und Gruppierungs-Logik ist pur und ohne Storage-Abhängigkeit
// testbar; die Persistenz nutzt den verschlüsselten local-finance-store und
// wandert über das Vault-Feld `claims` (vault-format.ts) in den Sync.

import type { LetterDocType, ParsedLetter } from "./letter-parser-service";
import { getCurrentUserId } from "./auth-service";
import { createDebt } from "./debt-service";
import {
  readLocalFinanceList,
  updateLocalFinanceItem,
  upsertLocalFinanceItem,
} from "./local-finance-store";

// -----------------------------------------------------------------------------
// Datenmodell
// -----------------------------------------------------------------------------

export type ClaimStatus = "offen" | "bestaetigt" | "bezahlt" | "eskaliert";

export interface ClaimTimelineEntry {
  id: string;
  doc_type: LetterDocType;
  /** ISO-Datum des Briefs (yyyy-mm-dd), falls erkannt. */
  brief_datum: string | null;
  gesamtbetrag: number | null;
  mahngebuehren: number | null;
  verzugszinsen: number | null;
  /** Absender dieses Briefs (bei Inkasso-Übergabe ≠ Akten-Ursprungsgläubiger). */
  sender: string | null;
  /** Empfänger-IBAN dieses Briefs — Basis der IBAN-Wechsel-Warnung (#50). */
  iban: string | null;
}

export interface Claim {
  id: string;
  user_id: string;
  /** Aktuell zuständiger Gläubiger / Zahlstelle (wechselt bei Inkasso-Übergabe). */
  creditor: string;
  /** Ursprünglicher Gläubiger (gesetzt nach Inkasso-Übergabe). */
  original_creditor: string | null;
  /** Aktueller Forderungsbetrag = Gesamtbetrag des jüngsten Briefs. */
  current_amount: number;
  hauptforderung: number | null;
  iban: string | null;
  verwendungszweck: string | null;
  aktenzeichen: string | null;
  rechnungsnummer: string | null;
  kundennummer: string | null;
  status: ClaimStatus;
  timeline: ClaimTimelineEntry[];
  /** Verknüpfte Schuld im Tilgungsplan (nach Bestätigung). */
  debt_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// -----------------------------------------------------------------------------
// Normalisierung
// -----------------------------------------------------------------------------

const LEGAL_FORM_RE =
  /\b(gmbh\s*&\s*co\.?\s*kg|gmbh|ag|se|kg|ohg|gbr|mbh|e\.?\s?v\.?|inc\.?|ltd\.?)\b/gi;

/** Vergleichsschlüssel für Gläubigernamen: Rechtsform/Satzzeichen entfernen. */
export function creditorKey(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(LEGAL_FORM_RE, " ")
    .replace(/[^a-z0-9äöüß]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function refKey(ref: string | null | undefined): string {
  return (ref ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function tokens(s: string | null | undefined): string[] {
  return (s ?? "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((t) => t.length >= 4);
}

/** Verwendungszweck-Ähnlichkeit: gemeinsames signifikantes Token genügt. */
export function similarReference(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const ta = tokens(a);
  const tb = new Set(tokens(b));
  return ta.some((t) => tb.has(t));
}

// -----------------------------------------------------------------------------
// Matching: ein Brief gegen bestehende Akten (absteigende Sicherheit)
// -----------------------------------------------------------------------------

export type MatchLevel = "sicher" | "stark" | "wahrscheinlich" | "inkasso_uebergabe";

export interface LetterMatch {
  claimId: string;
  level: MatchLevel;
  /** Stufen unterhalb „sicher/stark" bestätigt der Nutzer in der Review-UI. */
  requiresConfirmation: boolean;
  /** Erklärung für die Review-UI, z. B. die Inkasso-Botschaft. */
  message: string;
}

/** Plausible Gebühren-/Zins-Eskalation gegenüber dem bisherigen Betrag. */
function plausibleEscalation(oldAmount: number, newAmount: number): boolean {
  const diff = newAmount - oldAmount;
  return diff > 0 && diff <= 75 + oldAmount * 0.25;
}

function letterRefs(letter: ParsedLetter): string[] {
  return [letter.aktenzeichen?.value, letter.rechnungsnummer?.value, letter.kundennummer?.value]
    .map(refKey)
    .filter(Boolean);
}

function claimRefs(claim: Claim): string[] {
  return [claim.aktenzeichen, claim.rechnungsnummer, claim.kundennummer]
    .map(refKey)
    .filter(Boolean);
}

function sharesReference(letter: ParsedLetter, claim: Claim): boolean {
  const cRefs = new Set(claimRefs(claim));
  return letterRefs(letter).some((r) => cRefs.has(r));
}

export function matchLetter(letter: ParsedLetter, claims: Claim[]): LetterMatch | null {
  const senderKey = creditorKey(letter.creditor?.value);
  const letterAmount =
    letter.amounts.gesamtbetrag?.value ?? letter.amounts.hauptforderung?.value ?? null;

  // Stufe 1: gleicher Gläubiger + gleiches Aktenzeichen/Rechnungsnummer → sicher
  for (const claim of claims) {
    const sameCreditor =
      senderKey &&
      (senderKey === creditorKey(claim.creditor) ||
        senderKey === creditorKey(claim.original_creditor));
    if (sameCreditor && sharesReference(letter, claim)) {
      return {
        claimId: claim.id,
        level: "sicher",
        requiresConfirmation: false,
        message: "Gleicher Gläubiger, gleiches Aktenzeichen — derselbe Vorgang.",
      };
    }
  }

  // Stufe 2: gleiche Empfänger-IBAN + ähnlicher Verwendungszweck → stark
  if (letter.iban) {
    for (const claim of claims) {
      if (
        claim.iban === letter.iban.value &&
        (similarReference(letter.verwendungszweck?.value ?? null, claim.verwendungszweck) ||
          sharesReference(letter, claim))
      ) {
        return {
          claimId: claim.id,
          level: "stark",
          requiresConfirmation: false,
          message: "Gleiches Empfängerkonto und gleicher Verwendungszweck.",
        };
      }
    }
  }

  // Stufe 4 (vor Stufe 3 geprüft, weil spezifischer): Inkasso-Übergabe —
  // Absender wechselt komplett; Match über Ursprungsgläubiger + Referenz/Betrag.
  if (letter.docType.value === "inkasso" && letter.originalCreditor) {
    const origKey = creditorKey(letter.originalCreditor.value);
    for (const claim of claims) {
      const matchesOrigin =
        origKey === creditorKey(claim.creditor) ||
        origKey === creditorKey(claim.original_creditor);
      if (!matchesOrigin) continue;
      const refMatch = sharesReference(letter, claim);
      const amountMatch =
        letter.amounts.hauptforderung?.value != null &&
        (letter.amounts.hauptforderung.value === claim.hauptforderung ||
          letter.amounts.hauptforderung.value === claim.current_amount);
      if (refMatch || amountMatch) {
        return {
          claimId: claim.id,
          level: "inkasso_uebergabe",
          requiresConfirmation: !refMatch,
          message: `Das ist keine neue Schuld — das ist deine Rechnung von ${
            claim.original_creditor ?? claim.creditor
          }, jetzt beim Inkasso. Eine Forderung, nicht zwei.`,
        };
      }
    }
  }

  // Stufe 3: gleicher Gläubiger + Betrag = Vorbetrag + plausible Gebühren →
  // wahrscheinlich (Nutzer bestätigt)
  if (senderKey && letterAmount != null) {
    for (const claim of claims) {
      const sameCreditor =
        senderKey === creditorKey(claim.creditor) ||
        senderKey === creditorKey(claim.original_creditor);
      if (!sameCreditor) continue;
      if (
        letterAmount === claim.current_amount ||
        plausibleEscalation(claim.current_amount, letterAmount)
      ) {
        return {
          claimId: claim.id,
          level: "wahrscheinlich",
          requiresConfirmation: true,
          message:
            "Gleicher Gläubiger und der Betrag passt zur bisherigen Forderung plus Mahngebühren. Bitte kurz prüfen.",
        };
      }
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// Akte aus Brief erzeugen / Brief in Akte übernehmen
// -----------------------------------------------------------------------------

function timelineEntryFromLetter(letter: ParsedLetter): ClaimTimelineEntry {
  return {
    id: crypto.randomUUID(),
    doc_type: letter.docType.value,
    brief_datum: letter.briefDatum?.value ?? null,
    gesamtbetrag:
      letter.amounts.gesamtbetrag?.value ?? letter.amounts.hauptforderung?.value ?? null,
    mahngebuehren: letter.amounts.mahngebuehren?.value ?? null,
    verzugszinsen: letter.amounts.verzugszinsen?.value ?? null,
    sender: letter.creditor?.value ?? null,
    iban: letter.iban?.value ?? null,
  };
}

/** Zwei Timeline-Einträge, die denselben physischen Brief beschreiben (Duplikat im Stapel). */
function isDuplicateEntry(a: ClaimTimelineEntry, b: ClaimTimelineEntry): boolean {
  return (
    a.doc_type === b.doc_type &&
    a.gesamtbetrag === b.gesamtbetrag &&
    a.brief_datum === b.brief_datum
  );
}

function sortTimeline(timeline: ClaimTimelineEntry[]): ClaimTimelineEntry[] {
  const order: Record<string, number> = {
    rechnung: 0, zahlungserinnerung: 1, mahnung_1: 2, mahnung_2_plus: 3,
    inkasso: 4, mahnbescheid: 5, unbekannt: 6,
  };
  return [...timeline].sort((a, b) => {
    if (a.brief_datum && b.brief_datum && a.brief_datum !== b.brief_datum) {
      return a.brief_datum < b.brief_datum ? -1 : 1;
    }
    return (order[a.doc_type] ?? 9) - (order[b.doc_type] ?? 9);
  });
}

export function claimFromLetter(letter: ParsedLetter, userId = "local"): Claim {
  const now = new Date().toISOString();
  const amount =
    letter.amounts.gesamtbetrag?.value ?? letter.amounts.hauptforderung?.value ?? 0;
  const isInkasso = letter.docType.value === "inkasso";
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    creditor: letter.creditor?.value ?? "Unbekannter Absender",
    original_creditor: isInkasso ? letter.originalCreditor?.value ?? null : null,
    current_amount: amount,
    hauptforderung: letter.amounts.hauptforderung?.value ?? null,
    iban: letter.iban?.value ?? null,
    verwendungszweck: letter.verwendungszweck?.value ?? null,
    aktenzeichen: letter.aktenzeichen?.value ?? null,
    rechnungsnummer: letter.rechnungsnummer?.value ?? null,
    kundennummer: letter.kundennummer?.value ?? null,
    status: letter.docType.value === "mahnbescheid" ? "eskaliert" : "offen",
    timeline: [timelineEntryFromLetter(letter)],
    debt_id: null,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Brief in bestehende Akte übernehmen (pur). Der jüngste Brief bestimmt
 * Betrag und Zahlstelle; bei Inkasso-Übergabe wechselt der Gläubiger und der
 * Ursprungsgläubiger wird festgehalten. Duplikate im Stapel verändern nichts.
 */
export function applyLetterToClaim(claim: Claim, letter: ParsedLetter): Claim {
  const entry = timelineEntryFromLetter(letter);
  if (claim.timeline.some((e) => isDuplicateEntry(e, entry))) return claim;

  const timeline = sortTimeline([...claim.timeline, entry]);
  const latest = timeline[timeline.length - 1];
  const letterIsLatest = latest === entry || isDuplicateEntry(latest, entry);

  const next: Claim = {
    ...claim,
    timeline,
    updated_at: new Date().toISOString(),
    aktenzeichen: claim.aktenzeichen ?? letter.aktenzeichen?.value ?? null,
    rechnungsnummer: claim.rechnungsnummer ?? letter.rechnungsnummer?.value ?? null,
    kundennummer: claim.kundennummer ?? letter.kundennummer?.value ?? null,
    hauptforderung: claim.hauptforderung ?? letter.amounts.hauptforderung?.value ?? null,
  };

  if (letterIsLatest) {
    next.current_amount = entry.gesamtbetrag ?? claim.current_amount;
    if (letter.iban) next.iban = letter.iban.value;
    if (letter.verwendungszweck) next.verwendungszweck = letter.verwendungszweck.value;
    if (letter.docType.value === "inkasso") {
      next.original_creditor =
        claim.original_creditor ?? letter.originalCreditor?.value ?? claim.creditor;
      next.creditor = letter.creditor?.value ?? claim.creditor;
      if (letter.aktenzeichen) next.aktenzeichen = letter.aktenzeichen.value;
    }
    if (letter.docType.value === "mahnbescheid" && claim.status !== "bezahlt") {
      next.status = "eskaliert";
    }
  }
  return next;
}

// -----------------------------------------------------------------------------
// Stapel-Gruppierung: „Aus deinen 23 Briefen wurden 7 Forderungen."
// -----------------------------------------------------------------------------

export interface GroupingResult {
  claims: Claim[];
  letterCount: number;
  claimCount: number;
  /** Akten-IDs, bei denen mindestens ein Match Nutzer-Bestätigung braucht. */
  needsReview: Array<{ claimId: string; message: string }>;
  summary: string;
}

export function groupLettersIntoClaims(
  letters: ParsedLetter[],
  existingClaims: Claim[] = [],
  userId = "local",
): GroupingResult {
  const claims = [...existingClaims];
  const needsReview: GroupingResult["needsReview"] = [];

  for (const letter of letters) {
    const match = matchLetter(letter, claims);
    if (match) {
      const idx = claims.findIndex((c) => c.id === match.claimId);
      claims[idx] = applyLetterToClaim(claims[idx], letter);
      if (match.requiresConfirmation) {
        needsReview.push({ claimId: match.claimId, message: match.message });
      }
    } else {
      claims.push(claimFromLetter(letter, userId));
    }
  }

  const newClaimCount = claims.length - existingClaims.length;
  const mergedCount = claims.filter((c) => c.timeline.length > 1).length;
  return {
    claims,
    letterCount: letters.length,
    claimCount: claims.length,
    needsReview,
    summary:
      letters.length > claims.length || mergedCount > 0
        ? `Aus deinen ${letters.length} Briefen ${claims.length === 1 ? "wurde 1 Forderung" : `wurden ${claims.length} Forderungen`}. Nicht ${letters.length}.`
        : `${newClaimCount} Forderung${newClaimCount === 1 ? "" : "en"} erfasst.`,
  };
}

// -----------------------------------------------------------------------------
// Gebühren-Eskalation & Schutzfunktionen
// -----------------------------------------------------------------------------

/** „Aus 49 € wurden 87 €. Jeder Monat früher spart Gebühren." */
export function feeEscalation(claim: Claim): { first: number; current: number; message: string } | null {
  const amounts = claim.timeline
    .map((e) => e.gesamtbetrag)
    .filter((v): v is number => v != null);
  if (amounts.length < 2 || amounts[amounts.length - 1] <= amounts[0]) return null;
  const first = amounts[0];
  const current = amounts[amounts.length - 1];
  const fmt = (v: number) =>
    v.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return {
    first,
    current,
    message: `Aus ${fmt(first)} € wurden ${fmt(current)} €. Jeder Monat früher spart Gebühren.`,
  };
}

/** Doppelzahlungs-Schutz: bezahlte Akte warnt bei erneuter Zahlungsvorbereitung. */
export function doublePaymentWarning(claim: Claim): string | null {
  if (claim.status !== "bezahlt") return null;
  return `Diese Forderung von ${claim.creditor} ist bereits als bezahlt markiert. Eine zweite Zahlung wäre eine Doppelzahlung.`;
}

// -----------------------------------------------------------------------------
// Persistenz (verschlüsselter local-finance-store, Vault-Sync via `claims`)
// -----------------------------------------------------------------------------

async function localUserId(): Promise<string> {
  return (await getCurrentUserId()) || "local";
}

export async function getClaims(): Promise<Claim[]> {
  const claims = await readLocalFinanceList<Claim>("claims");
  return claims.filter((c) => !c.deleted_at);
}

export async function saveClaim(claim: Claim): Promise<Claim> {
  return upsertLocalFinanceItem<Claim>("claims", claim);
}

export async function importLetters(letters: ParsedLetter[]): Promise<GroupingResult> {
  const existing = await getClaims();
  const result = groupLettersIntoClaims(letters, existing, await localUserId());
  for (const claim of result.claims) {
    await upsertLocalFinanceItem<Claim>("claims", claim);
  }
  return result;
}

/**
 * Eine Bestätigung pro Akte, nicht pro Brief: erst danach wird die Akte zur
 * Schuld im Tilgungsplan (debt-service).
 */
export async function confirmClaim(claimId: string): Promise<Claim> {
  const claims = await readLocalFinanceList<Claim>("claims");
  const claim = claims.find((c) => c.id === claimId);
  if (!claim) throw new Error("Forderungsakte nicht gefunden");
  if (claim.debt_id) {
    return updateLocalFinanceItem<Claim>("claims", claimId, { status: "bestaetigt" });
  }

  const debt = await createDebt({
    name: claim.original_creditor
      ? `${claim.original_creditor} (via ${claim.creditor})`
      : claim.creditor,
    type: "other",
    balance: claim.current_amount,
    original_amount: claim.hauptforderung ?? claim.current_amount,
    notes: claim.aktenzeichen ? `Aktenzeichen: ${claim.aktenzeichen}` : null,
  });

  return updateLocalFinanceItem<Claim>("claims", claimId, {
    status: "bestaetigt",
    debt_id: debt.id,
  });
}

export async function markClaimPaid(claimId: string): Promise<Claim> {
  return updateLocalFinanceItem<Claim>("claims", claimId, { status: "bezahlt" });
}
