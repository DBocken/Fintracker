import { describe, it, expect, vi } from 'vitest';
import type { Transaction } from '../../types';

// Sortier-Contract: Die Storage-Schicht liefert datum-absteigend sortiert
// (transaction-storage-service sortiert VOR dem Limit — sonst verliert ein
// Limit die jüngsten Buchungen). Die Service-Schicht darf sich darauf
// verlassen und NICHT erneut sortieren; diese Tests pinnen den Contract,
// bevor redundante Sorts entfernt werden.
const storedRows: Transaction[] = [
  { id: 'c', date: '2026-07-03', amount: -3, payee: 'C', description: '', original_text: '', auto_mapped: false, confirmed: true },
  { id: 'b', date: '2026-07-02', amount: -2, payee: 'B', description: '', original_text: '', auto_mapped: false, confirmed: true },
  { id: 'b2', date: '2026-07-02', amount: -20, payee: 'B2', description: '', original_text: '', auto_mapped: false, confirmed: true },
  { id: 'a', date: '2026-07-01', amount: -1, payee: 'A', description: '', original_text: '', auto_mapped: false, confirmed: true },
];

vi.mock('../transaction-storage-service', () => ({
  transactionStorage: {
    getTransactions: vi.fn(async (limit: number, offset: number) => ({
      success: true,
      data: storedRows.slice(offset, offset + limit),
    })),
  },
}));

describe('transaction-service Sortier-Contract', () => {
  describe('Regression Protection', () => {
    it('[REGRESSION] sollte getTransactions datum-absteigend liefern (Storage-Reihenfolge unverändert)', async () => {
      const { getTransactions } = await import('../transaction-service');
      const rows = await getTransactions(1000);
      expect(rows.map((r) => r.id)).toEqual(['c', 'b', 'b2', 'a']);
    });

    it('[REGRESSION] sollte die stabile Reihenfolge innerhalb eines Tages erhalten', async () => {
      const { getTransactions } = await import('../transaction-service');
      const rows = await getTransactions(1000);
      // b vor b2 (Storage-Reihenfolge) — ein erneuter Sort dürfte das zwar
      // nicht ändern (stable sort), aber ohne Sort ist es garantiert.
      expect(rows.findIndex((r) => r.id === 'b')).toBeLessThan(rows.findIndex((r) => r.id === 'b2'));
    });

    it('[REGRESSION] sollte getTransactionsPaginated die Datum-Ordnung über Seiten hinweg erhalten', async () => {
      const { getTransactionsPaginated } = await import('../transaction-service');
      const page1 = await getTransactionsPaginated(1, 2);
      const page2 = await getTransactionsPaginated(2, 2);
      expect(page1.transactions.map((r) => r.id)).toEqual(['c', 'b']);
      expect(page2.transactions.map((r) => r.id)).toEqual(['b2', 'a']);
      expect(page1.total).toBe(4);
      expect(page2.hasMore).toBe(false);
    });
  });
});
