import { beforeEach, describe, expect, it } from 'vitest';
import type { Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';
import { idbSet, idbRemove } from '../idb-kv';
import { localEncryption } from '../local-crypto';
import { transactionStorage } from '../transaction-storage-service';
import { getTransactions } from '../transaction-service';
import { getIntegrityReport, clearIntegrityReport } from '../data-integrity-report';

/**
 * WP 1.2 (RES-2/DOM-2): Item-Validierung an der Transaktions-Lesegrenze.
 * `transaction-storage-service.ts` liest über einen eigenen Key
 * (`LOCAL_TRANSACTIONS_KEY`), NICHT über `readLocalFinanceList` — deshalb ein
 * eigener Test statt Wiederverwendung von `local-finance-store.test.ts`.
 */
const STORAGE_KEY = 'ausgabentracker_transactions_v3';

function goodTransaction(id: string): Transaction {
  return {
    id: asTransactionId(id),
    date: '2026-06-21',
    amount: -12.34,
    payee: 'REWE',
    description: 'Einkauf',
    original_text: 'REWE Einkauf',
    category_id: null,
    auto_mapped: false,
    confirmed: true,
  };
}

beforeEach(async () => {
  localEncryption.lock();
  localStorage.clear();
  await idbRemove(STORAGE_KEY);
  clearIntegrityReport();
});

describe('[REGRESSION] transaction-storage-service.getTransactions validiert Items an der Lesegrenze', () => {
  it('überspringt ein einzelnes kaputtes Item (amount als String) statt die Liste zu verwerfen', async () => {
    const good = [goodTransaction('t1'), goodTransaction('t2'), goodTransaction('t3')];
    const broken = { ...goodTransaction('t4'), amount: 'abc' };
    await idbSet(STORAGE_KEY, JSON.stringify([...good, broken]));

    const result = await transactionStorage.getTransactions(100, 0);

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(3);
    expect(result.data?.map((tx) => tx.id).sort()).toEqual(['t1', 't2', 't3']);
    expect(getIntegrityReport()).toEqual([{ key: 'transactions', skipped: 1 }]);
  });

  it('überspringt ein Item ohne id', async () => {
    const good = [goodTransaction('t1'), goodTransaction('t2'), goodTransaction('t3')];
    const broken = { date: '2026-01-01', amount: -5, payee: 'X' };
    await idbSet(STORAGE_KEY, JSON.stringify([...good, broken]));

    const result = await transactionStorage.getTransactions(100, 0);

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(3);
    expect(getIntegrityReport()).toEqual([{ key: 'transactions', skipped: 1 }]);
  });

  it('gute Listen ohne kaputte Items lösen KEINEN Bericht aus', async () => {
    await idbSet(STORAGE_KEY, JSON.stringify([goodTransaction('t1'), goodTransaction('t2')]));

    const result = await transactionStorage.getTransactions(100, 0);

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(getIntegrityReport()).toEqual([]);
  });
});

describe('[INTEGRITY] ein manipuliertes Item erreicht die Render-Schicht nie — geprüft an einem echten Aufrufer', () => {
  it('transaction-service.getTransactions() (von Hooks/Seiten konsumiert) liefert das manipulierte Item nicht zurück', async () => {
    // `getTransactions` aus `transaction-service.ts` ist der Aufrufer, den
    // Hooks/Seiten tatsächlich benutzen (z. B. `useTransactionsOverview`,
    // `useGlobalAtmosphere`) — nicht der rohe Service. Genau dieser Pfad
    // muss das manipulierte Item ausfiltern, bevor irgendeine Komponente es
    // sieht.
    const good = [goodTransaction('ok-1'), goodTransaction('ok-2')];
    const manipulated = { ...goodTransaction('manipulated'), amount: 'NaN-injection' };
    await idbSet(STORAGE_KEY, JSON.stringify([...good, manipulated]));

    const transactions = await getTransactions(100);

    expect(transactions.map((tx) => tx.id).sort()).toEqual(['ok-1', 'ok-2']);
    expect(transactions.find((tx) => tx.id === 'manipulated')).toBeUndefined();
    expect(getIntegrityReport()).toEqual([{ key: 'transactions', skipped: 1 }]);
  });
});
