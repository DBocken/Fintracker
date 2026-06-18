import type { Transaction } from '../types';

export interface TransferCandidate {
  /** Buchung mit der Abbuchung (negativer Betrag) */
  outgoing: Transaction;
  /** Buchung mit der Gutschrift (positiver Betrag) */
  incoming: Transaction;
  /** Tage zwischen den beiden Buchungsdaten */
  daysApart: number;
}

const AMOUNT_TOLERANCE = 0.005;
const MAX_DAYS_APART = 2;

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.abs(Math.round((new Date(a).getTime() - new Date(b).getTime()) / msPerDay));
}

/** Vereinheitlicht eine IBAN (Leerzeichen weg, Großbuchstaben) für den Vergleich. */
export function normalizeIban(iban?: string | null): string | null {
  if (!iban) return null;
  const normalized = iban.replace(/\s+/g, '').toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Findet Paare von Transaktionen auf unterschiedlichen eigenen Konten, die
 * vermutlich ein- und denselben internen Übertrag darstellen: gleicher
 * Betrag (entgegengesetztes Vorzeichen), unterschiedliche Konten und
 * Buchungsdatum innerhalb von {@link MAX_DAYS_APART} Tagen.
 */
export function findTransferCandidates(transactions: Transaction[]): TransferCandidate[] {
  const candidates: TransferCandidate[] = [];
  const used = new Set<string>();

  const outgoing = transactions.filter((t) => t.account_id && !t.is_transfer && t.amount < 0);
  const incoming = transactions.filter((t) => t.account_id && !t.is_transfer && t.amount > 0);

  for (const out of outgoing) {
    if (used.has(out.id || '')) continue;

    for (const inc of incoming) {
      if (used.has(inc.id || '')) continue;
      if (inc.account_id === out.account_id) continue;
      if (Math.abs(Math.abs(out.amount) - inc.amount) > AMOUNT_TOLERANCE) continue;

      const diff = daysBetween(out.date, inc.date);
      if (diff > MAX_DAYS_APART) continue;

      candidates.push({ outgoing: out, incoming: inc, daysApart: diff });
      used.add(out.id || '');
      used.add(inc.id || '');
      break;
    }
  }

  return candidates;
}

/** Minimale Kontoinfo für die IBAN-basierte Transfer-Erkennung. */
export interface AccountIbanRef {
  id: string;
  iban?: string | null;
  /** Live über die Bank angebunden? Nur für nicht-live-Konten wird gespiegelt. */
  isLive: boolean;
}

export interface InternalTransferPlan {
  /** Bereits vorhandene Buchung (z.B. frisch synchronisiert) mit erkannter Gegenkonto-IBAN. */
  source: Transaction;
  /** Eigenes Konto, dessen IBAN zur `counterparty_iban` der Quelle passt. */
  counterAccountId: string;
  /**
   * Falls die Gegenbuchung schon im Bestand liegt, wird nur verknüpft.
   * Ist sie nicht gesetzt, muss eine Spiegelbuchung angelegt werden.
   */
  existingCounterpart?: Transaction;
}

/**
 * Plant die Behandlung interner Überträge anhand der Gegenkonto-IBAN: Für jede
 * neue Buchung, deren `counterparty_iban` auf ein eigenes Konto zeigt, wird
 * entweder eine bereits vorhandene Gegenbuchung verknüpft oder – wenn das
 * Gegenkonto nicht live synchronisiert wird (z.B. per CSV gepflegtes
 * Tagesgeldkonto) – eine Spiegelbuchung eingeplant.
 *
 * Wird das Gegenkonto live synchronisiert und existiert die Gegenbuchung noch
 * nicht, passiert nichts: Die echte Gegenbuchung kommt mit dem nächsten Sync
 * dieses Kontos und wird dann verknüpft (keine Doppelbuchung).
 */
export function planInternalTransfers(
  newTransactions: Transaction[],
  allTransactions: Transaction[],
  accounts: AccountIbanRef[],
): InternalTransferPlan[] {
  const ibanToAccount = new Map<string, AccountIbanRef>();
  for (const acc of accounts) {
    const iban = normalizeIban(acc.iban);
    if (iban) ibanToAccount.set(iban, acc);
  }
  if (ibanToAccount.size === 0) return [];

  const plans: InternalTransferPlan[] = [];
  // Gegenbuchungen, die in diesem Lauf schon verplant wurden, nicht erneut nutzen.
  const usedCounterpartIds = new Set<string>();

  for (const source of newTransactions) {
    if (!source.account_id || source.is_transfer) continue;

    const counterIban = normalizeIban(source.counterparty_iban);
    if (!counterIban) continue;

    const counterAccount = ibanToAccount.get(counterIban);
    if (!counterAccount || counterAccount.id === source.account_id) continue;

    const existingCounterpart = allTransactions.find((t) => {
      if (!t.id || t.id === source.id) return false;
      if (t.account_id !== counterAccount.id) return false;
      if (t.is_transfer) return false;
      if (usedCounterpartIds.has(t.id)) return false;
      // Gegenbuchung hat entgegengesetztes Vorzeichen und (nahezu) gleichen Betrag.
      if (Math.sign(t.amount) === Math.sign(source.amount)) return false;
      if (Math.abs(Math.abs(t.amount) - Math.abs(source.amount)) > AMOUNT_TOLERANCE) return false;
      return daysBetween(t.date, source.date) <= MAX_DAYS_APART;
    });

    if (existingCounterpart?.id) {
      usedCounterpartIds.add(existingCounterpart.id);
      plans.push({ source, counterAccountId: counterAccount.id, existingCounterpart });
      continue;
    }

    // Keine Gegenbuchung vorhanden: nur für nicht-live-Konten spiegeln.
    if (counterAccount.isLive) continue;

    plans.push({ source, counterAccountId: counterAccount.id });
  }

  return plans;
}
