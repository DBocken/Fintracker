/**
 * Bereits als Uebertrag verknuepfte Buchungen zu Paaren zusammenfassen.
 *
 * Herausgeloest aus `TransferSuggestions` (WP 6.5a). Reine Logik ueber einer
 * Liste — kein React, kein I/O, damit einzeln pruefbar.
 */

import type { Transaction } from '@/lib/transaction-types';

/**
 * Fasst verknuepfte Uebertraege zu Paaren zusammen.
 *
 * Ein Paar erscheint genau EINMAL (nicht je Seite einmal); eine Buchung, deren
 * Gegenbuchung nicht in der Liste steht, wird allein gefuehrt statt
 * weggelassen — sonst verschwaende sie gerade dann, wenn etwas nicht stimmt.
 */
export function collectLinkedTransferPairs(transactions: Transaction[]): Transaction[][] {
  const pairs: Transaction[][] = [];
  const seen = new Set<string>();

  for (const transaction of transactions) {
    if (!transaction.is_transfer || !transaction.id || seen.has(transaction.id)) continue;
    const partner = transactions.find((other) => other.id === transaction.transfer_pair_id);
    seen.add(transaction.id);
    if (partner?.id) seen.add(partner.id);
    pairs.push(partner ? [transaction, partner] : [transaction]);
  }

  return pairs;
}
