import { describe, it, expect } from 'vitest';
import type { Transaction } from '@/types';
import { computeTransactionStats } from '../transaction-stats';

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    date: '2026-01-01',
    amount: 0,
    payee: '',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...overrides,
  };
}

describe('computeTransactionStats', () => {
  describe('Happy Path', () => {
    it('sollte Einnahmen, Ausgaben, Saldo und Anzahl für gemischte Buchungen berechnen', () => {
      const txs = [
        makeTx({ id: '1', amount: 500 }),
        makeTx({ id: '2', amount: -200 }),
        makeTx({ id: '3', amount: -50 }),
      ];
      expect(computeTransactionStats(txs)).toEqual({ income: 500, expenses: 250, balance: 250, count: 3 });
    });
  });

  describe('Edge Cases', () => {
    it('sollte leeres Array zu Nullwerten verarbeiten', () => {
      expect(computeTransactionStats([])).toEqual({ income: 0, expenses: 0, balance: 0, count: 0 });
    });

    it('sollte Transfers von Einnahmen/Ausgaben ausschließen, aber weiter in count zählen', () => {
      const txs = [
        makeTx({ id: '1', amount: 300, is_transfer: true }),
        makeTx({ id: '2', amount: 100 }),
      ];
      expect(computeTransactionStats(txs)).toEqual({ income: 100, expenses: 0, balance: 100, count: 2 });
    });

    it('sollte Buchungen mit Betrag 0 weder als Einnahme noch als Ausgabe zählen', () => {
      const txs = [makeTx({ id: '1', amount: 0 }), makeTx({ id: '2', amount: 100 })];
      expect(computeTransactionStats(txs)).toEqual({ income: 100, expenses: 0, balance: 100, count: 2 });
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte identische Stats wie die bisherige Inline-Reduce-Kette liefern', () => {
      const txs: Transaction[] = [
        makeTx({ id: '1', amount: 1000 }),
        makeTx({ id: '2', amount: -400 }),
        makeTx({ id: '3', amount: 250, is_transfer: true }),
        makeTx({ id: '4', amount: -250, is_transfer: true }),
        makeTx({ id: '5', amount: 0 }),
        makeTx({ id: '6', amount: -75 }),
        makeTx({ id: '7', amount: 600 }),
      ];

      // Alte Inline-Formel aus TransactionsPage.tsx (Z. 185–190), unverändert
      // nachgebaut als Referenzimplementierung für den Vergleich.
      const flow = txs.filter((tx) => !tx.is_transfer);
      const income = flow.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
      const expenses = flow.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      const legacy = { income, expenses, balance: income - expenses, count: txs.length };

      expect(computeTransactionStats(txs)).toEqual(legacy);
    });
  });
});
