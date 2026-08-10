/**
 * Zusammenfassen bereits verknuepfter Uebertraege (WP 6.5a).
 *
 * Die Schleife lag als `useMemo` in `TransferSuggestions` — reine Logik ueber
 * einer Liste, ohne React, ohne I/O. Sie hat zwei Eigenschaften, die man
 * einzeln pruefen koennen muss: Ein Paar erscheint genau EINMAL (nicht zweimal,
 * einmal je Seite), und eine Buchung ohne auffindbare Gegenbuchung faellt nicht
 * unter den Tisch.
 */

import { describe, it, expect } from 'vitest';
import type { Transaction } from '@/lib/transaction-types';
import { asTransactionId } from '@/lib/ids';
import { collectLinkedTransferPairs } from '../transfer-pairs';

function buchung(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: asTransactionId(id),
    user_id: 'u1',
    amount: -50,
    description: 'Übertrag',
    date: '2026-08-01',
    type: 'expense',
    account_id: 'a1',
    ...overrides,
  } as Transaction;
}

describe('collectLinkedTransferPairs', () => {
  it('sollte ein verknuepftes Paar genau einmal liefern', () => {
    const hin = buchung('t1', { is_transfer: true, transfer_pair_id: 't2' });
    const her = buchung('t2', { is_transfer: true, transfer_pair_id: 't1', amount: 50, account_id: 'a2' });

    const paare = collectLinkedTransferPairs([hin, her]);

    expect(paare).toHaveLength(1);
    expect(paare[0].map((b) => String(b.id))).toEqual(['t1', 't2']);
  });

  it('sollte eine Buchung ohne auffindbare Gegenbuchung allein fuehren statt sie zu verschlucken', () => {
    const einzeln = buchung('t1', { is_transfer: true, transfer_pair_id: 'nicht-da' });

    const paare = collectLinkedTransferPairs([einzeln]);

    expect(paare).toHaveLength(1);
    expect(paare[0]).toHaveLength(1);
  });

  it('sollte Buchungen ohne Uebertrags-Kennzeichen ignorieren', () => {
    expect(collectLinkedTransferPairs([buchung('t1'), buchung('t2')])).toEqual([]);
  });

  it('sollte mehrere Paare in Listenreihenfolge liefern', () => {
    const buchungen = [
      buchung('t1', { is_transfer: true, transfer_pair_id: 't2' }),
      buchung('t2', { is_transfer: true, transfer_pair_id: 't1' }),
      buchung('t3', { is_transfer: true, transfer_pair_id: 't4' }),
      buchung('t4', { is_transfer: true, transfer_pair_id: 't3' }),
    ];

    expect(collectLinkedTransferPairs(buchungen).map((p) => p.map((b) => String(b.id)))).toEqual([
      ['t1', 't2'],
      ['t3', 't4'],
    ]);
  });
});
