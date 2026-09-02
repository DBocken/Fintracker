import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

/**
 * WP 4.1c (PERF-1): der reale Migrationsschritt "Transaktionen: Blob ->
 * Quartals-Chunks" (`local-store-migrations.ts`, `LOCAL_STORE_SCHEMA_VERSION`
 * 2 -> 3). Vorgabe: `docs/architecture/transaction-storage-chunks.md`
 * (ADR, Abschnitt "Migration").
 *
 * Eigene Datei statt eines Zusatzfalls in `local-store-migrations.test.ts`:
 * jene Datei testet ausschließlich den Läufer selbst mit SYNTHETISCHEN
 * Schritten (per Vorgabe, s. dort) — hier wird der ECHTE, exportierte Schritt
 * geprüft.
 */

vi.mock('../idb-kv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../idb-kv')>();
  return { ...actual, idbSet: vi.fn(actual.idbSet) };
});

import { idbSet, idbGet, clearLocalKvStore } from '../idb-kv';
import { localEncryption } from '../local-crypto';
import { runStoreMigrations } from '../local-store-migrations';
import { getAllTransactions } from '../transaction-service';
import { clearIntegrityReport } from '../data-integrity-report';
import { readTransactionChunkIndex } from '../transaction-chunk-store';

const idbSetMock = idbSet as unknown as Mock;
// Die anfängliche Mock-Implementierung IST bereits das echte `idbSet` (s.
// `vi.fn(actual.idbSet)` oben) — als Referenz gesichert, damit ein Test nach
// einem injizierten Fehlschlag zum echten Verhalten zurückschalten kann,
// ohne bei jedem Aufruf neu zu importieren.
const realIdbSet = idbSetMock.getMockImplementation()!;
const V3_KEY = 'ausgabentracker_transactions_v3';
const VERSION_KEY = 'ausgabentracker_store_schema_version';

function tx(id: string, date: string) {
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
  };
}

beforeEach(async () => {
  localStorage.clear();
  await clearLocalKvStore();
  localEncryption.lock();
  clearIntegrityReport();
  idbSetMock.mockClear();
  // "Gespeicherter Stand 2" simulieren, ohne den Marker für die (heute
  // leere) Lücke 1->2 anzufassen: der Läufer soll genau den Schritt 2->3
  // ausführen.
  localStorage.setItem(VERSION_KEY, '2');
});

afterEach(async () => {
  idbSetMock.mockReset();
  await clearLocalKvStore();
  localStorage.clear();
  localEncryption.lock();
});

describe('Migrationsschritt "Transaktionen: Blob -> Quartals-Chunks" (WP 4.1c)', () => {
  it('Migrations-Roundtrip: liefert nach dem Lauf exakt dieselben Buchungen über mehrere Quartale, v3-Schlüssel ist weg', async () => {
    const items = [
      tx('t1', '2025-01-15'),
      tx('t2', '2025-02-20'),
      tx('t3', '2025-08-01'),
      tx('t4', '2026-05-01'),
      tx('t5', '2026-05-15'),
    ];
    await idbSet(V3_KEY, JSON.stringify(items));

    await runStoreMigrations();

    expect(await idbGet(V3_KEY)).toBeNull();
    expect(localStorage.getItem(V3_KEY)).toBeNull();
    expect(localStorage.getItem(VERSION_KEY)).toBe('3');

    const after = await getAllTransactions();
    expect(after).toHaveLength(items.length);
    expect(after.map((t) => t.id).sort()).toEqual(items.map((t) => t.id).sort());

    // Index deckt beide betroffenen Quartale ab (aus den Chunks abgeleitet).
    const index = await readTransactionChunkIndex();
    expect(index['2025-Q1']).toBe(2);
    expect(index['2025-Q3']).toBe(1);
    expect(index['2026-Q2']).toBe(2);
  });

  it('Migrations-Roundtrip bei aktiver Verschlüsselung', async () => {
    await localEncryption.enable('correct horse battery staple');
    const items = [tx('e1', '2026-01-10'), tx('e2', '2026-07-10')];
    await localEncryption.encryptAndStore(V3_KEY, items);
    idbSetMock.mockClear();

    await runStoreMigrations();

    expect(await idbGet(V3_KEY)).toBeNull();
    const after = await getAllTransactions();
    expect(after.map((t) => t.id).sort()).toEqual(['e1', 'e2']);
  });

  it('sollte ohne jeden v3-Bestand (Neuinstallation) klaglos durchlaufen', async () => {
    await runStoreMigrations();
    expect(localStorage.getItem(VERSION_KEY)).toBe('3');
    expect(await getAllTransactions()).toEqual([]);
  });

  it('[REGRESSION] Abbruch VOR dem Index-Schreiben lässt den v3-Blob als Wahrheit stehen und vollständig lesbar; ein erneuter Lauf vollendet die Migration', async () => {
    const items = [tx('t1', '2025-01-15'), tx('t2', '2026-05-01')];
    await idbSet(V3_KEY, JSON.stringify(items));
    idbSetMock.mockClear();

    // Erster idbSet-Aufruf während der Migration ist der Chunk-Write des
    // ersten Quartals; der ZWEITE ist dessen Index-Update
    // (`writeTransactionChunk`: Chunk zuerst, Index danach). Der Fehler
    // trifft genau diesen zweiten Aufruf — der Chunk ist also bereits
    // physisch geschrieben, sein Index-Eintrag NICHT mehr.
    let call = 0;
    idbSetMock.mockImplementation(async (key: string, value: string) => {
      call += 1;
      if (call === 2) throw new Error('Speicher voll (simuliert)');
      return realIdbSet(key, value);
    });

    await expect(runStoreMigrations()).rejects.toThrow('Speicher voll (simuliert)');

    // Kern des Pakets: die Version wurde NICHT festgeschrieben, v3 ist
    // unverändert die Wahrheit und über die normale Fassade vollständig lesbar.
    expect(localStorage.getItem(VERSION_KEY)).toBe('2');
    expect(await idbGet(V3_KEY)).not.toBeNull();
    const duringOutage = await getAllTransactions();
    expect(duringOutage.map((t) => t.id).sort()).toEqual(['t1', 't2']);

    // Retry ohne Fehler: vollendet die Migration; halb geschriebene Chunks
    // werden dabei überschrieben (ADR), nicht gelesen.
    idbSetMock.mockImplementation(realIdbSet);

    await runStoreMigrations();

    expect(localStorage.getItem(VERSION_KEY)).toBe('3');
    expect(await idbGet(V3_KEY)).toBeNull();
    const afterRetry = await getAllTransactions();
    expect(afterRetry.map((t) => t.id).sort()).toEqual(['t1', 't2']);
  });

  it('[REGRESSION] gesperrter Tresor beim Migrationsstart wirft einen typisierten Fehler statt abzustürzen', async () => {
    await localEncryption.enable('correct horse battery staple');
    await localEncryption.encryptAndStore(V3_KEY, [tx('t1', '2026-01-10')]);
    localEncryption.lock();

    await expect(runStoreMigrations()).rejects.toThrow();
    // Version bleibt unangetastet — der Lauf ist beim nächsten (entsperrten)
    // Start nachholbar, kein Datenverlust.
    expect(localStorage.getItem(VERSION_KEY)).toBe('2');
  });
});
