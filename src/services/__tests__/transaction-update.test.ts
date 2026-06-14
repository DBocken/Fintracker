import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Transaction } from '../../types';
import { transactionStorage } from '../transaction-storage-service';
import { updateTransaction } from '../transaction-service';

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    date: '2026-01-01',
    amount: -49.99,
    payee: 'LSW Energie',
    description: 'Abschlag Strom',
    original_text: '',
    auto_mapped: true,
    confirmed: false,
    ...partial,
  };
}

async function read(id: string): Promise<Transaction | undefined> {
  const res = await transactionStorage.getTransactions(1000, 0);
  return (res.data || []).find((t) => t.id === id);
}

describe('updateTransaction (erweiterte Felder)', () => {
  beforeEach(async () => {
    await transactionStorage.initialize();
  });

  afterEach(async () => {
    // Storage wird über den globalen afterEach-Hook (idb-kv) geleert.
  });

  it('persistiert is_contract und contract_cycle', async () => {
    const t = tx({ id: 'lsw-1' });
    await transactionStorage.saveTransactions([t]);

    const [result] = await updateTransaction([
      { id: 'lsw-1', is_contract: true, contract_cycle: 'monthly' },
    ]);

    expect(result.is_contract).toBe(true);
    expect(result.contract_cycle).toBe('monthly');

    const persisted = await read('lsw-1');
    expect(persisted?.is_contract).toBe(true);
    expect(persisted?.contract_cycle).toBe('monthly');
  });

  it('setzt category_id und subcategory_id und markiert als bestätigt', async () => {
    const t = tx({ id: 'lsw-2', auto_mapped: true, confirmed: false });
    await transactionStorage.saveTransactions([t]);

    const [result] = await updateTransaction([
      { id: 'lsw-2', category_id: 'wohnen', subcategory_id: 'strom' },
    ]);

    expect(result.category_id).toBe('wohnen');
    expect(result.subcategory_id).toBe('strom');
    expect(result.auto_mapped).toBe(false);
    expect(result.confirmed).toBe(true);
  });

  it('lässt nicht übergebene Felder unangetastet', async () => {
    const t = tx({ id: 'lsw-3', category_id: 'wohnen', is_contract: true, contract_cycle: 'yearly' });
    await transactionStorage.saveTransactions([t]);

    // Nur Zyklus ändern – Kategorie soll erhalten bleiben.
    const [result] = await updateTransaction([{ id: 'lsw-3', contract_cycle: 'monthly' }]);

    expect(result.category_id).toBe('wohnen');
    expect(result.is_contract).toBe(true);
    expect(result.contract_cycle).toBe('monthly');
  });

  it('verarbeitet mehrere Updates in einem Aufruf', async () => {
    await transactionStorage.saveTransactions([tx({ id: 'a' }), tx({ id: 'b' })]);

    const results = await updateTransaction([
      { id: 'a', is_contract: true, contract_cycle: 'monthly' },
      { id: 'b', category_id: 'wohnen' },
    ]);

    expect(results).toHaveLength(2);
    expect((await read('a'))?.is_contract).toBe(true);
    expect((await read('b'))?.category_id).toBe('wohnen');
  });

  it('wirft bei unbekannter Transaktions-ID', async () => {
    await expect(updateTransaction([{ id: 'gibt-es-nicht', is_contract: true }])).rejects.toThrow();
  });
});
