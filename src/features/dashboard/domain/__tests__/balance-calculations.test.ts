import { describe, it, expect } from 'vitest';
import type { Account, Transaction } from '@/types';
import {
  computeLocalBalances,
  computeAnchoredBalance,
  computeEffectiveBalances,
  computeTotalEffectiveBalance,
  pickBalanceAnchor,
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

describe('pickBalanceAnchor', () => {
  describe('Happy Path', () => {
    it('sollte den Bank-Saldo mit seinem Zeitstempel als Anker liefern', () => {
      const account = makeAccount({
        live_balance_amount: 500,
        live_balance_type: 'closingBooked',
        live_balance_updated_at: '2026-08-20T09:00:00.000Z',
      });
      expect(pickBalanceAnchor(account)).toEqual({
        amount: 500,
        date: '2026-08-20T09:00:00.000Z',
        source: 'bank',
        balanceType: 'closingBooked',
      });
    });

    it('sollte den Startsaldo mit seinem Stichtag als Anker liefern, wenn kein Bank-Saldo vorliegt', () => {
      const account = makeAccount({ opening_balance: 200, opening_balance_date: '2026-01-31' });
      expect(pickBalanceAnchor(account)).toEqual({
        amount: 200,
        date: '2026-01-31',
        source: 'opening',
      });
    });
  });

  describe('Edge Cases', () => {
    it('sollte ohne jeden Saldo null liefern', () => {
      const account = makeAccount({ opening_balance: null, live_balance_amount: null });
      expect(pickBalanceAnchor(account)).toBeNull();
    });

    it('sollte den jüngeren Stichtag gewinnen lassen, wenn beide Anker datiert sind', () => {
      const account = makeAccount({
        live_balance_amount: 100,
        live_balance_updated_at: '2026-03-01T00:00:00.000Z',
        opening_balance: 900,
        opening_balance_date: '2026-07-01',
      });
      expect(pickBalanceAnchor(account)?.source).toBe('opening');
    });

    it('sollte bei gleichem Stichtag die Bank gewinnen lassen', () => {
      const account = makeAccount({
        live_balance_amount: 100,
        live_balance_updated_at: '2026-07-01T12:00:00.000Z',
        opening_balance: 900,
        opening_balance_date: '2026-07-01',
      });
      expect(pickBalanceAnchor(account)?.source).toBe('bank');
    });

    it('sollte einen undatierten Bank-Saldo einem datierten Startsaldo vorziehen', () => {
      const account = makeAccount({
        live_balance_amount: 100,
        live_balance_updated_at: null,
        opening_balance: 900,
        opening_balance_date: '2026-07-01',
      });
      expect(pickBalanceAnchor(account)?.source).toBe('bank');
    });
  });
});

describe('computeAnchoredBalance', () => {
  describe('Happy Path', () => {
    it('sollte nur Buchungen NACH dem Stichtag auf den Anker addieren', () => {
      const account = makeAccount({ opening_balance: 1000, opening_balance_date: '2026-06-30' });
      const txs = [
        makeTx({ account_id: 'acc-1', date: '2026-05-15', amount: -400 }),
        makeTx({ account_id: 'acc-1', date: '2026-07-01', amount: -100 }),
      ];
      expect(computeAnchoredBalance(account, txs)).toBe(900);
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte Historie vor dem Stichtag NICHT doppelt zählen', () => {
      // Der gemeldete Fehler: Startsaldo 1.000 € zum 30.06., danach werden
      // Buchungen ab Januar nachimportiert. Vor der Korrektur ergab das
      // 1000 - 400 - 100 = 500 statt 900 — der Nutzer musste manuell nachziehen.
      const account = makeAccount({ opening_balance: 1000, opening_balance_date: '2026-06-30' });
      const alt = [
        makeTx({ account_id: 'acc-1', date: '2026-01-10', amount: -250 }),
        makeTx({ account_id: 'acc-1', date: '2026-03-05', amount: -150 }),
      ];
      const neu = [makeTx({ account_id: 'acc-1', date: '2026-07-01', amount: -100 })];
      expect(computeAnchoredBalance(account, [...alt, ...neu])).toBe(900);
    });

    it('[REGRESSION] sollte Buchungen AM Stichtag als im Anker enthalten behandeln', () => {
      const account = makeAccount({ opening_balance: 1000, opening_balance_date: '2026-06-30' });
      const txs = [makeTx({ account_id: 'acc-1', date: '2026-06-30', amount: -100 })];
      expect(computeAnchoredBalance(account, txs)).toBe(1000);
    });

    it('[REGRESSION] sollte einen Bank-Saldo nicht einfrieren, sondern spätere Buchungen aufaddieren', () => {
      // Vorher schlug live_balance_amount jede spätere Buchung — die manuelle
      // Korrektur war ab dem Moment ihrer Eingabe wieder falsch.
      const account = makeAccount({
        live_balance_amount: 500,
        live_balance_updated_at: '2026-08-20T09:00:00.000Z',
      });
      const txs = [
        makeTx({ account_id: 'acc-1', date: '2026-08-19', amount: -999 }),
        makeTx({ account_id: 'acc-1', date: '2026-08-21', amount: -50 }),
      ];
      expect(computeAnchoredBalance(account, txs)).toBe(450);
    });

    it('sollte einen undatierten Startsaldo weiterhin über ALLE Buchungen rechnen (Altbestand)', () => {
      const account = makeAccount({ opening_balance: 200, opening_balance_date: null });
      const txs = [
        makeTx({ account_id: 'acc-1', date: '2020-01-01', amount: 30 }),
        makeTx({ account_id: 'acc-1', date: '2026-08-21', amount: 20 }),
      ];
      expect(computeAnchoredBalance(account, txs)).toBe(250);
    });

    it('sollte einen undatierten Bank-Saldo weiterhin als Momentaufnahme stehen lassen (Altbestand)', () => {
      const account = makeAccount({ opening_balance: 999, live_balance_amount: 500 });
      const txs = [makeTx({ account_id: 'acc-1', date: '2026-08-21', amount: -50 })];
      expect(computeAnchoredBalance(account, txs)).toBe(500);
    });
  });

  describe('Edge Cases', () => {
    it('sollte ohne Anker die blanke Buchungssumme liefern', () => {
      const account = makeAccount({ opening_balance: null, live_balance_amount: null });
      const txs = [makeTx({ account_id: 'acc-1', date: '2026-02-02', amount: -75 })];
      expect(computeAnchoredBalance(account, txs)).toBe(-75);
    });

    it('sollte Buchungen fremder Konten ignorieren', () => {
      const account = makeAccount({ opening_balance: 100, opening_balance_date: '2026-01-01' });
      const txs = [makeTx({ account_id: 'acc-2', date: '2026-05-05', amount: -60 })];
      expect(computeAnchoredBalance(account, txs)).toBe(100);
    });
  });
});

describe('computeEffectiveBalances', () => {
  describe('Happy Path', () => {
    it('sollte den Bank-Saldo als Anker verwenden und als bank kennzeichnen', () => {
      const accounts = [
        makeAccount({
          id: 'a',
          live_balance_amount: 500,
          live_balance_type: 'interimAvailable',
          live_balance_updated_at: '2026-08-20T09:00:00.000Z',
        }),
      ];
      const result = computeEffectiveBalances(accounts, []);
      expect(result.a).toEqual({ amount: 500, source: 'bank', balanceType: 'interimAvailable' });
    });

    it('sollte den lokalen Saldo aus Startsaldo + Buchungen nach dem Stichtag berechnen', () => {
      const accounts = [
        makeAccount({
          id: 'a',
          opening_balance: 200,
          opening_balance_date: '2026-01-01',
          live_balance_amount: null,
        }),
      ];
      const txs = [makeTx({ account_id: 'a', date: '2026-02-01', amount: 50 })];
      const result = computeEffectiveBalances(accounts, txs);
      expect(result.a).toEqual({ amount: 250, source: 'local', balanceType: undefined });
    });
  });

  describe('Edge Cases', () => {
    it('sollte leeres Accounts-Array zu leerem Objekt verarbeiten', () => {
      expect(computeEffectiveBalances([], [])).toEqual({});
    });

    it('[REGRESSION] sollte live_balance_amount 0 als gesetzten Bank-Saldo behandeln (nicht als fehlend)', () => {
      const accounts = [makeAccount({ id: 'a', live_balance_amount: 0, opening_balance: 999 })];
      const result = computeEffectiveBalances(accounts, [
        makeTx({ account_id: 'a', date: '2026-05-05', amount: 999 }),
      ]);
      expect(result.a).toEqual({ amount: 0, source: 'bank', balanceType: undefined });
    });

    it('sollte undefined live_balance_amount als lokal behandeln', () => {
      const accounts = [makeAccount({ id: 'a', live_balance_amount: undefined, opening_balance: 10 })];
      const result = computeEffectiveBalances(accounts, []);
      expect(result.a).toEqual({ amount: 10, source: 'local', balanceType: undefined });
    });

    it('sollte ohne jeden Anker die blanke Buchungssumme liefern', () => {
      const accounts = [
        makeAccount({ id: 'a', opening_balance: null, live_balance_amount: null }),
      ];
      const txs = [makeTx({ account_id: 'a', date: '2026-03-03', amount: 30 })];
      const result = computeEffectiveBalances(accounts, txs);
      expect(result.a).toEqual({ amount: 30, source: 'local', balanceType: undefined });
    });

    it('sollte nicht-numerischen live_balance_amount über Number() auf 0 abbilden, aber weiter als bank markieren', () => {
      const accounts = [makeAccount({ id: 'a', live_balance_amount: NaN })];
      const result = computeEffectiveBalances(accounts, []);
      expect(result.a).toEqual({ amount: 0, source: 'bank', balanceType: undefined });
    });

    it('sollte Transaktionen ohne account_id keinem Konto zurechnen', () => {
      const accounts = [makeAccount({ id: 'a', opening_balance: 10, live_balance_amount: null })];
      const txs = [makeTx({ account_id: null, date: '2026-04-04', amount: 500 })];
      expect(computeEffectiveBalances(accounts, txs).a.amount).toBe(10);
    });

    it('sollte mehrere Konten unabhängig berechnen', () => {
      const accounts = [
        makeAccount({ id: 'a', live_balance_amount: 100, live_balance_updated_at: '2026-08-01' }),
        makeAccount({
          id: 'b',
          opening_balance: 20,
          opening_balance_date: '2026-08-01',
          live_balance_amount: null,
        }),
      ];
      const txs = [
        makeTx({ account_id: 'a', date: '2026-08-05', amount: 7 }),
        makeTx({ account_id: 'b', date: '2026-08-05', amount: 5 }),
      ];
      const result = computeEffectiveBalances(accounts, txs);
      expect(result).toEqual({
        a: { amount: 107, source: 'bank', balanceType: undefined },
        b: { amount: 25, source: 'local', balanceType: undefined },
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
        makeTx({ account_id: 'a', date: '2026-02-01', amount: 30 }),
        makeTx({ account_id: 'b', date: '2026-02-01', amount: -10 }),
      ];
      const accounts = [
        makeAccount({
          id: 'a',
          opening_balance: 100,
          opening_balance_date: '2026-01-01',
          live_balance_amount: null,
        }),
        makeAccount({ id: 'b', live_balance_amount: 200, live_balance_updated_at: '2026-01-01' }),
      ];
      const effectiveBalances = computeEffectiveBalances(accounts, txs);
      const total = computeTotalEffectiveBalance(accounts, effectiveBalances);
      // a: 100 + 30 = 130 (Anker 01.01., Buchung danach)
      // b: 200 - 10 = 190 (Bank-Anker 01.01., spätere Buchung zählt jetzt mit —
      //    vor der Korrektur fror der Bank-Saldo auf 200 ein)
      expect(total).toBe(320);
    });
  });
});
