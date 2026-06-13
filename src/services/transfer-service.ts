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
