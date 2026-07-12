import { describe, it, expect } from 'vitest';
import type { Account, Transaction } from '@/types';
import {
  computeLocalBalances,
  computeEffectiveBalances,
  computeTotalEffectiveBalance,
} from '../balance-calculations';

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

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: 'acc-1',
    user_id: 'user-1',
    name: 'Girokonto',
    type: 'checking' as Account['type'],
    currency: 'EUR',
    color: '#000',
    icon: 'bank',
    is_budget_pool_member: true,
    order_index: 0,
    ...overrides,
  };
}

describe('computeLocalBalances', () => {
  describe('Happy Path', () => {
    it('sollte Beträge je account_id aufsummieren', () => {
      const txs = [
        makeTx({ account_id: 'a', amount: 100 }),
        makeTx({ account_id: 'a', amount: -30 }),
        makeTx({ account_id: 'b', amount: 50 }),
      ];
      expect(computeLocalBalances(txs)).toEqual({ a: 70, b: 50 });
    });
  });

  describe('Edge Cases', () => {
    it('sollte leeres Array zu leerem Objekt verarbeiten', () => {
      expect(computeLocalBalances([])).toEqual({});
    });

    it('sollte Transaktionen ohne account_id überspringen', () => {
      const txs = [
        makeTx({ account_id: undefined, amount: 100 }),
        makeTx({ account_id: null, amount: 50 }),
        makeTx({ account_id: 'a', amount: 10 }),
      ];
      expect(computeLocalBalances(txs)).toEqual({ a: 10 });
    });

    it('sollte amount 0 und negative Beträge korrekt behandeln', () => {
      const txs = [
        makeTx({ account_id: 'a', amount: 0 }),
        makeTx({ account_id: 'a', amount: -25 }),
      ];
      expect(computeLocalBalances(txs)).toEqual({ a: -25 });
    });

    it('sollte fehlendes amount (falsy) wie 0 behandeln', () => {
      const txs = [makeTx({ account_id: 'a', amount: undefined as unknown as number })];
      expect(computeLocalBalances(txs)).toEqual({ a: 0 });
    });
  });
});

describe('computeEffectiveBalances', () => {
  describe('Happy Path', () => {
    it('sollte Bank-Live-Saldo verwenden, wenn live_balance_amount gesetzt ist', () => {
      const accounts = [makeAccount({ id: 'a', live_balance_amount: 500, live_balance_type: 'interimAvailable' })];
      const result = computeEffectiveBalances(accounts, {});
      expect(result.a).toEqual({ amount: 500, source: 'bank', balanceType: 'interimAvailable' });
    });

    it('sollte lokalen Saldo aus Eröffnungssaldo + localBalances berechnen, wenn kein Live-Saldo vorliegt', () => {
      const accounts = [makeAccount({ id: 'a', opening_balance: 200, live_balance_amount: null })];
      const result = computeEffectiveBalances(accounts, { a: 50 });
      expect(result.a).toEqual({ amount: 250, source: 'local' });
    });
  });

  describe('Edge Cases', () => {
    it('sollte leeres Accounts-Array zu leerem Objekt verarbeiten', () => {
      expect(computeEffectiveBalances([], {})).toEqual({});
    });

    it('[REGRESSION] sollte live_balance_amount 0 als gesetzten Bank-Saldo behandeln (nicht als fehlend)', () => {
      const accounts = [makeAccount({ id: 'a', live_balance_amount: 0, opening_balance: 999 })];
      const result = computeEffectiveBalances(accounts, { a: 999 });
      expect(result.a).toEqual({ amount: 0, source: 'bank', balanceType: undefined });
    });

    it('sollte undefined live_balance_amount als lokal behandeln', () => {
      const accounts = [makeAccount({ id: 'a', live_balance_amount: undefined, opening_balance: 10 })];
      const result = computeEffectiveBalances(accounts, {});
      expect(result.a).toEqual({ amount: 10, source: 'local' });
    });

    it('sollte fehlenden opening_balance als 0 behandeln', () => {
      const accounts = [makeAccount({ id: 'a', opening_balance: undefined, live_balance_amount: null })];
      const result = computeEffectiveBalances(accounts, { a: 30 });
      expect(result.a).toEqual({ amount: 30, source: 'local' });
    });

    it('sollte fehlenden Eintrag in localBalances als 0 behandeln', () => {
      const accounts = [makeAccount({ id: 'a', opening_balance: 5, live_balance_amount: null })];
      const result = computeEffectiveBalances(accounts, {});
      expect(result.a).toEqual({ amount: 5, source: 'local' });
    });

    it('sollte nicht-numerischen live_balance_amount über Number() auf 0 abbilden, aber weiter als bank markieren', () => {
      const accounts = [makeAccount({ id: 'a', live_balance_amount: NaN })];
      const result = computeEffectiveBalances(accounts, {});
      expect(result.a).toEqual({ amount: 0, source: 'bank', balanceType: undefined });
    });

    it('sollte mehrere Konten unabhängig berechnen', () => {
      const accounts = [
        makeAccount({ id: 'a', live_balance_amount: 100 }),
        makeAccount({ id: 'b', opening_balance: 20, live_balance_amount: null }),
      ];
      const result = computeEffectiveBalances(accounts, { b: 5 });
      expect(result).toEqual({
        a: { amount: 100, source: 'bank', balanceType: undefined },
        b: { amount: 25, source: 'local' },
      });
    });
  });
});

describe('computeTotalEffectiveBalance', () => {
  describe('Happy Path', () => {
    it('sollte die Summe aller effektiven Salden über alle Konten bilden', () => {
      const accounts = [makeAccount({ id: 'a' }), makeAccount({ id: 'b' })];
      const effectiveBalances = {
        a: { amount: 100, source: 'bank' as const },
        b: { amount: 50, source: 'local' as const },
      };
      expect(computeTotalEffectiveBalance(accounts, effectiveBalances)).toBe(150);
    });
  });

  describe('Edge Cases', () => {
    it('sollte leeres Accounts-Array zu 0 verarbeiten', () => {
      expect(computeTotalEffectiveBalance([], {})).toBe(0);
    });

    it('sollte fehlende Einträge in effectiveBalances als 0 behandeln', () => {
      const accounts = [makeAccount({ id: 'a' }), makeAccount({ id: 'orphan' })];
      const effectiveBalances = { a: { amount: 10, source: 'bank' as const } };
      expect(computeTotalEffectiveBalance(accounts, effectiveBalances)).toBe(10);
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte end-to-end mit computeLocalBalances/computeEffectiveBalances konsistent sein', () => {
      const txs = [
        makeTx({ account_id: 'a', amount: 30 }),
        makeTx({ account_id: 'b', amount: -10 }),
      ];
      const accounts = [
        makeAccount({ id: 'a', opening_balance: 100, live_balance_amount: null }),
        makeAccount({ id: 'b', live_balance_amount: 200 }),
      ];
      const localBalances = computeLocalBalances(txs);
      const effectiveBalances = computeEffectiveBalances(accounts, localBalances);
      const total = computeTotalEffectiveBalance(accounts, effectiveBalances);
      // a: 100 + 30 = 130 (local); b: 200 (bank, live überschreibt lokale -10)
      expect(total).toBe(330);
    });
  });
});
