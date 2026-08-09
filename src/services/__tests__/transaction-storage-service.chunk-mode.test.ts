import { beforeEach, describe, expect, it } from 'vitest';
import type { Transaction } from '@/types';
import { idbGet, idbKeys, idbSet, clearLocalKvStore } from '../idb-kv';
import { localEncryption } from '../local-crypto';
import { transactionStorage } from '../transaction-storage-service';
import { getTransactions, saveTransactions, updateTransaction, deleteTransaction } from '../transaction-service';

/**
 * WP 4.1c (PERF-1): `transactionStorage` schaltet auf die Chunk-Ablage um,
 * sobald der v3-Blob fehlt (Migration gelaufen bzw. Neuinstallation ohne
 * v3-Altbestand). Diese Tests decken genau diesen — bislang ungetesteten —
 * Zweig ab; die bestehenden v3-Tests (`transaction-storage-service.*.test.ts`)
 * bleiben unverändert grün, weil sie den v3-Blob selbst anlegen und damit im
 * Legacy-Zweig bleiben (`hasLegacyV3Blob`).
 */

function tx(id: string, date: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
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
  // Voller Reset (nicht nur setItem): mehrere Tests in dieser Datei
  // aktivieren die Verschlüsselung (`localEncryption.enable`), deren Config
  // in localStorage lebt (nicht in IndexedDB) — ohne `localStorage.clear()`
  // bliebe sie über Tests hinweg "aktiv, aber gesperrt" stehen und ließe
  // spätere, unverschlüsselte Tests fälschlich mit LocalEncryptionLockedError
  // scheitern.
  localStorage.clear();
  localStorage.setItem('ausgabentracker_locale_v1', 'de');
  localEncryption.lock();
  await clearLocalKvStore();
  await transactionStorage.clearLocalCache();
});

describe('transactionStorage im Chunk-Modus (kein v3-Blob vorhanden)', () => {
  it('sollte eine neue Buchung in einem v4-Chunk ablegen, NICHT im v3-Schlüssel', async () => {
    await saveTransactions([tx('t1', '2026-05-10')]);

    expect(await idbGet('ausgabentracker_transactions_v3')).toBeNull();
    const v4Keys = (await idbKeys()).filter((k) => k.startsWith('ausgabentracker_transactions_v4_'));
    expect(v4Keys.length).toBeGreaterThan(0);

    const all = await getTransactions(100);
    expect(all.map((t) => t.id)).toEqual(['t1']);
  });

  it('sollte Buchungen über mehrere Quartale korrekt speichern und wieder lesen', async () => {
    await saveTransactions([
      tx('q1', '2026-01-10'),
      tx('q2', '2026-04-10'),
      tx('q3', '2026-08-10'),
    ]);

    const all = await getTransactions(100);
    expect(all.map((t) => t.id).sort()).toEqual(['q1', 'q2', 'q3']);
  });

  it('[REGRESSION] ein Vollesen nach einer Einzeländerung liefert den geänderten Stand (kein veralteter Cache)', async () => {
    await saveTransactions([tx('t1', '2026-05-10')]);
    await getTransactions(100); // Cache wärmen

    await updateTransaction([{ id: 't1', category_id: 'local-cat-lebensmittel' }]);

    const after = await getTransactions(100);
    expect(after.find((t) => t.id === 't1')?.category_id).toBe('local-cat-lebensmittel');
  });

  it('updateTransaction mit geändertem Datum lässt die Buchung ins neue Quartal wandern', async () => {
    await saveTransactions([tx('t1', '2026-01-10')]);

    await transactionStorage.updateTransaction('t1', { date: '2026-08-01' });

    const all = await getTransactions(100);
    expect(all).toHaveLength(1);
    expect(all[0].date).toBe('2026-08-01');

    // Physisch im neuen Quartal, nicht mehr im alten.
    const q1Raw = await idbGet('ausgabentracker_transactions_v4_2026-Q1');
    const q3Raw = await idbGet('ausgabentracker_transactions_v4_2026-Q3');
    expect(q1Raw ? JSON.parse(q1Raw) : []).toEqual([]);
    expect(JSON.parse(q3Raw!).map((t: Transaction) => t.id)).toEqual(['t1']);
  });

  it('deleteTransaction entfernt die Buchung aus ihrem Quartal', async () => {
    await saveTransactions([tx('t1', '2026-05-10'), tx('t2', '2026-05-11')]);
    await deleteTransaction('t1');

    const all = await getTransactions(100);
    expect(all.map((t) => t.id)).toEqual(['t2']);
  });

  it('ein identischer Reimport (gleiche ID) erzeugt keine Dopplung, auch im Chunk-Modus', async () => {
    await saveTransactions([tx('csv-stable', '2026-05-10', { category_id: 'lebensmittel' })]);
    await saveTransactions([tx('csv-stable', '2026-05-10', { category_id: null })]);

    const all = await getTransactions(100);
    expect(all).toHaveLength(1);
    expect(all[0].category_id).toBe('lebensmittel');
  });

  describe('[REGRESSION] getTransactions() meldet einen Fehlschlag als Fehlschlag statt als leere Liste', () => {
    it('gesperrter Tresor: transactionStorage.getTransactions() liefert success:false (nicht success:true/data:[])', async () => {
      await localEncryption.enable('correct horse battery staple');
      await saveTransactions([tx('t1', '2026-05-10')]);
      localEncryption.lock();

      const result = await transactionStorage.getTransactions(100, 0);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
    });

    it('gesperrter Tresor: die Fassade (transaction-service.getTransactions) wirft statt eine leere Liste vorzutäuschen', async () => {
      await localEncryption.enable('correct horse battery staple');
      await saveTransactions([tx('t1', '2026-05-10')]);
      localEncryption.lock();

      await expect(getTransactions(100)).rejects.toThrow();
    });

    it('kaputter Chunk: getTransactions() liefert success:false statt den korrupten Chunk stillschweigend zu unterschlagen', async () => {
      await saveTransactions([tx('t1', '2026-05-10')]);
      const key = 'ausgabentracker_transactions_v4_2026-Q2';
      await idbSet(key, '{not valid json');

      const result = await transactionStorage.getTransactions(100, 0);
      expect(result.success).toBe(false);
    });
  });
});

describe('transactionStorage.clearLocalCache() räumt auch die Chunk-Ablage auf (WP 4.1c)', () => {
  it('sollte v4-Chunks + Index entfernen, nicht nur den v3-Schlüssel', async () => {
    await saveTransactions([tx('t1', '2026-05-10')]);
    expect((await idbKeys()).some((k) => k.startsWith('ausgabentracker_transactions_v4_'))).toBe(true);

    await transactionStorage.clearLocalCache();

    expect((await idbKeys()).some((k) => k.startsWith('ausgabentracker_transactions_v4_'))).toBe(false);
    expect(await getTransactions(100)).toEqual([]);
  });
});
