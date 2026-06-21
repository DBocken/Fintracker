import { beforeEach, describe, expect, it } from 'vitest';
import type { Transaction } from '@/types';
import { idbRemove } from './idb-kv';
import { localEncryption } from './local-crypto';
import { transactionStorage } from './transaction-storage-service';

const STORAGE_KEY = 'ausgabentracker_transactions_v3';

function transaction(id: string, categoryId: string | null = null): Transaction {
  return {
    id,
    date: '2026-06-21',
    amount: -12.34,
    payee: 'REWE',
    description: 'Einkauf',
    original_text: 'REWE Einkauf',
    category_id: categoryId,
    auto_mapped: false,
    confirmed: true,
  };
}

beforeEach(async () => {
  localEncryption.lock();
  localStorage.clear();
  await idbRemove(STORAGE_KEY);
});

describe('[INTEGRITY] transaction storage idempotency', () => {
  it('speichert dieselbe Import-ID nur einmal', async () => {
    await transactionStorage.saveTransactions([transaction('csv-stable')]);
    await transactionStorage.saveTransactions([transaction('csv-stable')]);

    const stored = await transactionStorage.getTransactions(100, 0);
    expect(stored.success).toBe(true);
    expect(stored.data).toHaveLength(1);
  });

  it('überschreibt eine manuelle Kategorie nicht durch identischen Reimport', async () => {
    await transactionStorage.saveTransactions([transaction('csv-stable', 'lebensmittel')]);
    await transactionStorage.saveTransactions([transaction('csv-stable', null)]);

    const stored = await transactionStorage.getTransactions(100, 0);
    expect(stored.data?.[0].category_id).toBe('lebensmittel');
  });

  it('behält unterschiedliche Buchungen trotz gleichen Inhalts, wenn ihre IDs verschieden sind', async () => {
    await transactionStorage.saveTransactions([transaction('row-1'), transaction('row-2')]);
    const stored = await transactionStorage.getTransactions(100, 0);
    expect(stored.data?.map((item) => item.id)).toEqual(['row-1', 'row-2']);
  });
});

describe('[SECURITY] CSV export', () => {
  it('neutralisiert Tabellenformeln in nutzerkontrollierten Textfeldern', async () => {
    const malicious = transaction('formula');
    malicious.payee = '=HYPERLINK("https://example.invalid","click")';
    malicious.description = '@SUM(1+1)';

    const exported = await transactionStorage.exportToCSV([malicious]);
    expect(exported.success).toBe(true);
    expect(exported.data).toContain("'=HYPERLINK");
    expect(exported.data).toContain("'@SUM");
  });
});
