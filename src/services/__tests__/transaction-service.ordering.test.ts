import { beforeEach, describe, expect, it } from 'vitest';
import type { Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';
import { clearLocalKvStore } from '../idb-kv';
import { localEncryption } from '../local-crypto';
import { transactionStorage } from '../transaction-storage-service';
import {
  getAllTransactions,
  getTransactionsPage,
  remapCategoryInLocalTransactions,
  saveTransactions,
} from '../transaction-service';

/**
 * Audit 2026-09, F2: `getTransactions(limit)` sortierte absteigend und schnitt
 * ab — rund 45 Aufrufer wählten ein Literal (500…10000), und keiner prüfte, ob
 * es griff. Ab genügend Bestand trainierte der Klassifikator auf einem
 * Ausschnitt, die Vertragserkennung sah keine Jahresverträge, und Steuer- und
 * EÜR-Summen waren schlicht falsch — lautlos, weil ein Ausschnitt genauso
 * aussieht wie ein Bestand.
 */

function tx(id: string, date: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: asTransactionId(id),
    date,
    amount: -12.34,
    payee: 'REWE',
    description: 'Einkauf',
    original_text: 'REWE Einkauf',
    category_id: null,
    auto_mapped: false,
    confirmed: true,
    ...overrides,
  };
}

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem('ausgabentracker_locale_v1', 'de');
  localEncryption.lock();
  await clearLocalKvStore();
  await transactionStorage.clearLocalCache();
});

describe('getAllTransactions', () => {
  it('sollte datum-absteigend und unbeschnitten liefern', async () => {
    await saveTransactions([
      tx('alt', '2024-01-01'),
      tx('neu', '2026-08-01'),
      tx('mitte', '2025-05-01'),
    ]);

    const alle = await getAllTransactions();
    expect(alle.map((t) => t.id)).toEqual(['neu', 'mitte', 'alt']);
  });
});

describe('getTransactionsPage', () => {
  it('sollte hasMore und total korrekt setzen', async () => {
    await saveTransactions([
      tx('a', '2026-03-01'),
      tx('b', '2026-02-01'),
      tx('c', '2026-01-01'),
    ]);

    const erste = await getTransactionsPage(2, 0);
    expect(erste.transactions.map((t) => t.id)).toEqual(['a', 'b']);
    expect(erste.total).toBe(3);
    expect(erste.hasMore).toBe(true);

    const zweite = await getTransactionsPage(2, 2);
    expect(zweite.transactions.map((t) => t.id)).toEqual(['c']);
    expect(zweite.hasMore).toBe(false);
  });
});

describe('[REGRESSION] Bestand jenseits der alten 10.000er-Kappung', () => {
  it('[REGRESSION] sollte ohne Limit auch mehr als 10000 Buchungen vollständig liefern', async () => {
    // Zwei Quartale, damit der Bestand über mehrere Chunks liegt.
    const viele: Transaction[] = [];
    for (let i = 0; i < 5001; i += 1) viele.push(tx(`q1-${i}`, '2026-01-15'));
    for (let i = 0; i < 5000; i += 1) viele.push(tx(`q2-${i}`, '2026-04-15'));
    await saveTransactions(viele);

    const alle = await getAllTransactions();
    expect(alle).toHaveLength(10001);
  }, 60000);

  it('[REGRESSION] sollte auch Buchungen jenseits der 10000 jüngsten umhängen', async () => {
    const viele: Transaction[] = [];
    // Die älteste Buchung trägt die alte Kategorie und liegt hinter der Kappung.
    viele.push(tx('aeltester', '2020-01-01', { category_id: 'alt' }));
    for (let i = 0; i < 10000; i += 1) viele.push(tx(`neuer-${i}`, '2026-01-15'));
    await saveTransactions(viele);

    const geaendert = await remapCategoryInLocalTransactions('alt', 'neu');

    expect(geaendert).toBe(1);
    const alle = await getAllTransactions();
    expect(alle.find((t) => t.id === 'aeltester')!.category_id).toBe('neu');
  }, 60000);
});
