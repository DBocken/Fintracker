import { describe, expect, it } from 'vitest';
import {
  findeUnserialisierteSchreibpfade,
  istSpeicherschicht,
} from '../store-serialization-core.mjs';

/**
 * Wächter gegen unserialisiertes Lesen-Ändern-Schreiben (Issue #311).
 *
 * Die Tests halten beide Richtungen fest: Er muss den echten Fehler sehen —
 * und er muss die legitimen Formen in Ruhe lassen. Ein Wächter, der reines
 * Lesen anmeckert, wird abgeschaltet statt befolgt.
 */

describe('istSpeicherschicht', () => {
  it('sollte Services und Slice-Datenschichten prüfen', () => {
    expect(istSpeicherschicht('src/services/debt-service.ts')).toBe(true);
    expect(istSpeicherschicht('src/features/trading/data/positions.ts')).toBe(true);
  });

  it('sollte Tests und Darstellung nicht prüfen', () => {
    expect(istSpeicherschicht('src/services/__tests__/debt-service.test.ts')).toBe(false);
    expect(istSpeicherschicht('src/components/dashboard/Dashboard.tsx')).toBe(false);
    expect(istSpeicherschicht('src/lib/money.ts')).toBe(false);
  });
});

describe('findeUnserialisierteSchreibpfade', () => {
  it('sollte Lesen und Schreiben im selben Rumpf melden', () => {
    const quelle = `
      export async function addRule(rule) {
        const rules = await readLocalFinanceList('merchantRules');
        rules.push(rule);
        await writeLocalFinanceList('merchantRules', rules);
      }
    `;
    const funde = findeUnserialisierteSchreibpfade(quelle, 'src/services/x-service.ts');
    expect(funde).toHaveLength(1);
    expect(funde[0].funktion).toBe('addRule');
    expect(funde[0].familie).toBe('Finanz-Collections');
  });

  it('sollte schweigen, wenn der Ablauf in withKeyLock steht', () => {
    const quelle = `
      export async function addRule(rule) {
        return withKeyLock('merchantRules', async () => {
          const rules = await readLocalFinanceList('merchantRules');
          rules.push(rule);
          await writeLocalFinanceList('merchantRules', rules);
        });
      }
    `;
    expect(findeUnserialisierteSchreibpfade(quelle, 'src/services/x-service.ts')).toEqual([]);
  });

  it('sollte schweigen, wenn mutateLocalFinanceList benutzt wird', () => {
    const quelle = `
      export async function addRule(rule) {
        await mutateLocalFinanceList('merchantRules', (rules) => [...rules, rule]);
      }
    `;
    expect(findeUnserialisierteSchreibpfade(quelle, 'src/services/x-service.ts')).toEqual([]);
  });

  it('sollte reines Lesen nicht melden', () => {
    const quelle = `
      export async function getRules() {
        return readLocalFinanceList('merchantRules');
      }
    `;
    expect(findeUnserialisierteSchreibpfade(quelle, 'src/services/x-service.ts')).toEqual([]);
  });

  it('sollte reines Ersetzen der ganzen Liste nicht melden', () => {
    const quelle = `
      export async function replaceRules(rules) {
        return writeLocalFinanceList('merchantRules', rules);
      }
    `;
    expect(findeUnserialisierteSchreibpfade(quelle, 'src/services/x-service.ts')).toEqual([]);
  });

  it('sollte zwei getrennte Funktionen nicht als Paar werten', () => {
    const quelle = `
      export async function getRules() {
        return readLocalFinanceList('merchantRules');
      }
      export async function replaceRules(rules) {
        return writeLocalFinanceList('merchantRules', rules);
      }
    `;
    expect(findeUnserialisierteSchreibpfade(quelle, 'src/services/x-service.ts')).toEqual([]);
  });

  it('sollte Lesen der einen und Schreiben der anderen Familie nicht als Paar werten', () => {
    // Verschiedene Speicherschlüssel teilen keinen Zwischenzustand.
    const quelle = `
      export async function mischen() {
        const cats = await readLocalCategoriesRaw();
        await writeLocalFinanceList('merchantRules', cats);
      }
    `;
    expect(findeUnserialisierteSchreibpfade(quelle, 'src/services/x-service.ts')).toEqual([]);
  });

  it('sollte den Verstoß nur einmal melden, wenn er in einer inneren Funktion steht', () => {
    const quelle = `
      export async function aussen() {
        const helfer = async () => {
          const rules = await readLocalFinanceList('merchantRules');
          await writeLocalFinanceList('merchantRules', rules);
        };
        await helfer();
      }
    `;
    const funde = findeUnserialisierteSchreibpfade(quelle, 'src/services/x-service.ts');
    expect(funde).toHaveLength(1);
    expect(funde[0].funktion).toBe('helfer');
  });

  it('sollte die Einstellungs- und Kategorien-Familie ebenfalls kennen', () => {
    const einstellungen = `
      export async function updateLocalUserSettings(settings) {
        const current = await getLocalUserSettings();
        await schreibeLokaleEinstellungen({ ...current, ...settings });
      }
    `;
    expect(findeUnserialisierteSchreibpfade(einstellungen, 'src/services/s.ts')[0].familie).toBe(
      'Nutzereinstellungen',
    );

    const kategorien = `
      export async function saveLocalCategory(category) {
        const categories = await readLocalCategoriesRaw();
        await writeLocalCategories([...categories, category]);
      }
    `;
    expect(findeUnserialisierteSchreibpfade(kategorien, 'src/services/s.ts')[0].familie).toBe(
      'Kategorien',
    );
  });

  it('sollte die Buchungs-Chunk-Familie kennen (Chunk lesen, Chunk schreiben, kein Lock)', () => {
    const quelle = `
      async function deleteLocalTransactionChunked(id) {
        const chunk = await readTransactionChunk(quarter);
        await writeTransactionChunk(quarter, chunk.filter((tx) => tx.id !== id));
      }
    `;
    const funde = findeUnserialisierteSchreibpfade(quelle, 'src/services/transaction-storage-service.ts');
    expect(funde).toHaveLength(1);
    expect(funde[0].familie).toBe('Buchungs-Chunks');
  });

  it('sollte readAllTransactionChunks gefolgt von writeTransactionChunk als Paar werten', () => {
    const quelle = `
      async function saveLocalTransactionsChunked(neue) {
        const alle = await readAllTransactionChunks();
        await writeTransactionChunk(quartal, [...alle, ...neue]);
      }
    `;
    expect(
      findeUnserialisierteSchreibpfade(quelle, 'src/services/transaction-storage-service.ts')[0].familie,
    ).toBe('Buchungs-Chunks');
  });

  it('sollte auch den Migrationspfad sehen, der aus dem v3-Blob in Chunks schreibt', () => {
    // Der dritte Schreiber: `local-store-migrations.ts` liest NICHT über
    // readTransactionChunk, sondern über readLegacyV3Transactions — ohne
    // dieses Verb wäre ausgerechnet der Pfad unsichtbar, der ganze Quartale
    // überschreibt.
    const quelle = `
      async function migrateTransactionsToQuarterlyChunks() {
        const transactions = await readLegacyV3Transactions();
        for (const [quarter, items] of byQuarter) {
          await writeTransactionChunk(quarter, items);
        }
      }
    `;
    expect(
      findeUnserialisierteSchreibpfade(quelle, 'src/services/local-store-migrations.ts')[0].familie,
    ).toBe('Buchungs-Chunks');
  });

  it('sollte den v3-Blob (getLocalTransactions → setLocalTransactions) als Familie kennen', () => {
    const quelle = `
      async function saveLocalTransactions(neue) {
        const existing = await this.getLocalTransactions();
        await this.setLocalTransactions([...existing.data, ...neue]);
      }
    `;
    expect(
      findeUnserialisierteSchreibpfade(quelle, 'src/services/transaction-storage-service.ts')[0].familie,
    ).toBe('Buchungs-Blob (v3)');
  });

  it('sollte schweigen, wenn der Chunk-Ablauf in withKeyLock steht', () => {
    const quelle = `
      async function deleteLocalTransactionChunked(id) {
        return withKeyLock(TRANSACTION_STORE_LOCK_KEY, async () => {
          const chunk = await readTransactionChunk(quarter);
          await writeTransactionChunk(quarter, chunk.filter((tx) => tx.id !== id));
        });
      }
    `;
    expect(findeUnserialisierteSchreibpfade(quelle, 'src/services/transaction-storage-service.ts')).toEqual([]);
  });
});
