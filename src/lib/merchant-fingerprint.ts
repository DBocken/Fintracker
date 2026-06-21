import type { Transaction } from "@/types";
import { normalizeMerchantName } from "@/services/merchant-normalization";
import { normalizeIban } from "@/services/transfer-service";

/**
 * Händler-Fingerprint & Transaktionsfamilien.
 *
 * Eine einzige Quelle dafür, wann zwei Buchungen "gleichwertig" sind. Damit lassen
 * sich (a) ähnliche Buchungen gemeinsam bearbeiten, (b) Verträge stabil über die
 * Zeit gruppieren und (c) Nutzerentscheidungen (z. B. "kein Vertrag") dauerhaft an
 * eine Händlerfamilie binden – statt an eine einzelne ID oder eine Kategorie.
 *
 * Priorisierte Match-Kette (vom stärksten zum schwächsten Signal):
 *   1. Bankseitige Gegen-IBAN (Mandats-/Gläubiger-Ersatz)
 *   2. Normalisierter Händlername
 *   3. Richtung (Einnahme/Ausgabe) – immer Teil des Schlüssels
 */

export type TransactionDirection = "in" | "out";

export function transactionDirection(tx: Pick<Transaction, "amount">): TransactionDirection {
  return tx.amount >= 0 ? "in" : "out";
}

/** Grund, warum eine Buchung einem Fingerprint zugeordnet wurde (erklärbares Matching). */
export type FingerprintReason = "iban" | "merchant";

export interface FingerprintInfo {
  fingerprint: string;
  reason: FingerprintReason;
}

/**
 * Liefert den Fingerprint einer Buchung inkl. Begründung. Richtung ist immer Teil
 * des Schlüssels, damit eine Gutschrift und eine Abbuchung desselben Händlers nicht
 * in derselben Familie landen.
 */
export function merchantFingerprintInfo(tx: Transaction): FingerprintInfo {
  const dir = transactionDirection(tx);
  const iban = normalizeIban(tx.counterparty_iban);
  if (iban) {
    return { fingerprint: `iban:${iban}|${dir}`, reason: "iban" };
  }
  const merchant = normalizeMerchantName(tx.payee) || (tx.payee || "").toLowerCase().trim();
  return { fingerprint: `merchant:${merchant}|${dir}`, reason: "merchant" };
}

/** Kurzform: nur der Fingerprint-String. */
export function merchantFingerprint(tx: Transaction): string {
  return merchantFingerprintInfo(tx).fingerprint;
}

/** Menschlich lesbare Begründung für die Gruppierung (UI: "Warum gruppiert?"). */
export function fingerprintReasonLabel(reason: FingerprintReason): string {
  switch (reason) {
    case "iban":
      return "Gleiche Bankverbindung (IBAN) und Richtung";
    case "merchant":
      return "Gleicher Händlername und Richtung";
  }
}

/** Korridor um einen Betrag, innerhalb dessen zwei Beträge als gleich gelten (±10 %). */
const AMOUNT_CORRIDOR = 0.1;

function amountInCorridor(a: number, b: number): boolean {
  const x = Math.abs(a);
  const y = Math.abs(b);
  if (x === 0 && y === 0) return true;
  const ref = Math.max(x, y, 1);
  return Math.abs(x - y) / ref <= AMOUNT_CORRIDOR;
}

export interface SimilarTransactions {
  /** Sehr wahrscheinlich dieselbe wiederkehrende Zahlung (Fingerprint + Konto + Betragskorridor). */
  exact: Transaction[];
  /** Gleicher Händler/Richtung, aber abweichender Betrag oder Konto – wahrscheinlich. */
  probable: Transaction[];
  /** Begründung der Gruppierung (für erklärbares Matching im UI). */
  reason: FingerprintReason;
}

/**
 * Findet zu einer Buchung gleichwertige Buchungen in der Gesamtmenge und trennt
 * sichere von wahrscheinlichen Treffern. Die Ausgangsbuchung selbst ist nicht
 * enthalten.
 */
export function findSimilarTransactions(target: Transaction, all: Transaction[]): SimilarTransactions {
  const { fingerprint, reason } = merchantFingerprintInfo(target);
  const exact: Transaction[] = [];
  const probable: Transaction[] = [];

  for (const tx of all) {
    if (tx === target) continue;
    if (tx.id && target.id && tx.id === target.id) continue;
    if (merchantFingerprint(tx) !== fingerprint) continue;

    const sameAccount = (tx.account_id ?? null) === (target.account_id ?? null);
    if (sameAccount && amountInCorridor(tx.amount, target.amount)) {
      exact.push(tx);
    } else {
      probable.push(tx);
    }
  }

  return { exact, probable, reason };
}
