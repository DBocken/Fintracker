import { beforeEach, describe, expect, it } from 'vitest';
import type { Transaction } from '@/types';
import { clearLocalKvStore } from '../idb-kv';
import { localEncryption } from '../local-crypto';
import { transactionStorage } from '../transaction-storage-service';
import { writeTransactionChunk } from '../transaction-chunk-store';
import { quarterKeyForDate, type QuarterKey } from '@/lib/transaction-quarter';

/**
 * WP 4.1c (PERF-1) — "Wonach der Umbau zu beurteilen ist"
 * (`docs/architecture/transaction-storage-chunks.md`): die drei Messungen am
 * ECHTEN Service, 5 000 Buchungen, Verschlüsselung an, mit v3-Vergleichszahl.
 *
 * Läuft bewusst am realen `transactionStorage` (nicht simuliert): v3-Modus
 * wird erzeugt, indem der v3-Schlüssel direkt gefüllt wird (Legacy-Zweig,
 * `hasLegacyV3Blob`); v4-Modus, indem NUR die Chunk-Ablage gefüllt wird (der
 * Zustand nach einer abgeschlossenen Migration).
 *
 * Diese Datei ist bewusst informativ statt eines strengen Perf-Gates: absolute
 * Millisekunden hängen an der Ausführungsmaschine. Was geprüft wird, ist die
 * VERHÄLTNISZAHL aus der ADR ("kaltes Vollesen darf nicht um mehr als die
 * Hälfte steigen") — mit deutlichem Konsolen-Report, damit ein Reißen der
 * Grenze sichtbar bleibt statt stillschweigend zu verschwinden.
 */

const PASSWORD = 'correct horse battery staple';
const V3_KEY = 'ausgabentracker_transactions_v3';
const TRANSACTION_COUNT = 5000;
const QUARTERS = 12; // 3 Jahre, dieselbe Körnung wie die ADR-Baseline-Messung

function buildTransactions(count: number, quarters: number): Transaction[] {
  const txs: Transaction[] = [];
  const startYear = 2023;
  for (let i = 0; i < count; i++) {
    const q = i % quarters;
    const year = startYear + Math.floor(q / 4);
    const quarterInYear = q % 4;
    const month = quarterInYear * 3 + 1 + (i % 3);
    const day = 1 + (i % 27);
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    txs.push({
      id: `perf-${i}`,
      date,
      amount: -Math.round((10 + ((i * 37) % 490)) * 100) / 100,
      payee: i % 7 === 0 ? 'REWE' : i % 5 === 0 ? 'Netflix' : 'Muster GmbH',
      description: 'Testbuchung',
      original_text: 'Testbuchung',
      category_id: i % 3 === 0 ? 'local-cat-lebensmittel' : null,
      auto_mapped: true,
      confirmed: true,
    } as Transaction);
  }
  return txs;
}

function groupByQuarter(transactions: Transaction[]): Map<QuarterKey, Transaction[]> {
  const map = new Map<QuarterKey, Transaction[]>();
  for (const t of transactions) {
    const q = quarterKeyForDate(t.date);
    const list = map.get(q);
    if (list) list.push(t);
    else map.set(q, [t]);
  }
  return map;
}

interface Measurement {
  coldFullReadMs: number;
  singleUpdateMs: number;
  fullReadAfterEditMs: number;
}

async function resetStorage(): Promise<void> {
  localStorage.clear();
  await clearLocalKvStore();
  localEncryption.lock();
}

/** v3: EIN Blob, per Definition kein Chunk-Cache — jeder Vollesen-Aufruf entschlüsselt den Gesamtbestand neu. */
async function measureV3(transactions: Transaction[], sampleId: string): Promise<Measurement> {
  await resetStorage();
  await localEncryption.enable(PASSWORD);
  await localEncryption.encryptAndStore(V3_KEY, transactions);

  const coldStart = performance.now();
  const cold = await transactionStorage.getTransactions(10000, 0);
  const coldFullReadMs = performance.now() - coldStart;
  expect(cold.success).toBe(true);
  expect(cold.data).toHaveLength(transactions.length);

  const updateStart = performance.now();
  const updated = await transactionStorage.updateTransaction(sampleId, { category_id: 'local-cat-perf-updated' });
  const singleUpdateMs = performance.now() - updateStart;
  expect(updated.success).toBe(true);

  const warmStart = performance.now();
  const warm = await transactionStorage.getTransactions(10000, 0);
  const fullReadAfterEditMs = performance.now() - warmStart;
  expect(warm.data?.find((t) => t.id === sampleId)?.category_id).toBe('local-cat-perf-updated');

  return { coldFullReadMs, singleUpdateMs, fullReadAfterEditMs };
}

/** v4: Quartals-Chunks + Index + Chunk-Cache — Zustand nach abgeschlossener Migration (kein v3-Schlüssel). */
async function measureV4(transactions: Transaction[], sampleId: string): Promise<Measurement> {
  await resetStorage();
  await localEncryption.enable(PASSWORD);
  for (const [quarter, items] of groupByQuarter(transactions)) {
    await writeTransactionChunk(quarter, items);
  }

  const coldStart = performance.now();
  const cold = await transactionStorage.getTransactions(10000, 0);
  const coldFullReadMs = performance.now() - coldStart;
  expect(cold.success).toBe(true);
  expect(cold.data).toHaveLength(transactions.length);

  const updateStart = performance.now();
  const updated = await transactionStorage.updateTransaction(sampleId, { category_id: 'local-cat-perf-updated' });
  const singleUpdateMs = performance.now() - updateStart;
  expect(updated.success).toBe(true);

  const warmStart = performance.now();
  const warm = await transactionStorage.getTransactions(10000, 0);
  const fullReadAfterEditMs = performance.now() - warmStart;
  expect(warm.data?.find((t) => t.id === sampleId)?.category_id).toBe('local-cat-perf-updated');

  return { coldFullReadMs, singleUpdateMs, fullReadAfterEditMs };
}

describe('PERF-1 (WP 4.1c): die drei Messungen am echten Service, 5 000 Buchungen, Verschlüsselung an', () => {
  beforeEach(async () => {
    await resetStorage();
  });

  it('misst Einzeländerung, kaltes Vollesen und Vollesen-nach-Einzeländerung für v3 (Blob) und v4 (Quartals-Chunks) und vergleicht sie', async () => {
    const transactions = buildTransactions(TRANSACTION_COUNT, QUARTERS);
    const sampleId = transactions[Math.floor(TRANSACTION_COUNT / 2)].id!;

    const v3 = await measureV3(transactions, sampleId);
    const v4 = await measureV4(transactions, sampleId);

    const coldRatio = v4.coldFullReadMs / Math.max(v3.coldFullReadMs, 1);

    console.log(
      [
        '',
        '=== PERF-1 (WP 4.1c) — 5000 Buchungen, 12 Quartale, Verschlüsselung an ===',
        `Einzeländerung          v3=${v3.singleUpdateMs.toFixed(2)}ms   v4=${v4.singleUpdateMs.toFixed(2)}ms`,
        `Kaltes Vollesen         v3=${v3.coldFullReadMs.toFixed(2)}ms   v4=${v4.coldFullReadMs.toFixed(2)}ms   (Verhältnis v4/v3 = ${coldRatio.toFixed(2)}x, ADR-Grenze: <= 1.5x)`,
        `Vollesen nach Änderung  v3=${v3.fullReadAfterEditMs.toFixed(2)}ms   v4=${v4.fullReadAfterEditMs.toFixed(2)}ms`,
        '',
      ].join('\n'),
    );

    // ADR "Wonach der Umbau zu beurteilen ist": kaltes Vollesen darf gegenüber
    // v3 steigen, aber NICHT um mehr als die Hälfte. Reißt es die Grenze, ist
    // laut ADR die Körnung erneut zu prüfen — nicht der Messwert wegzuerklären.
    expect(coldRatio).toBeLessThanOrEqual(1.5);

    // Die eigentliche Erwartung der ADR (Chunk-Cache): ein Vollesen direkt
    // nach einer Einzeländerung ist in v4 sehr klein (nur ein Quartal neu
    // entschlüsselt), in v3 dagegen so teuer wie jedes andere Vollesen.
    expect(v4.fullReadAfterEditMs).toBeLessThan(v4.coldFullReadMs);
  }, 60_000);
});
