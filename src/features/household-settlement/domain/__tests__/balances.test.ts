import { describe, it, expect } from 'vitest';
import { computeMemberBalances, computeDebts } from '../balances';
import { splitWeighted, splitEqually } from '@/services/household-service';
import type { SharedExpenseSplit } from '@/lib/household-types';

function split(overrides: Partial<SharedExpenseSplit>): SharedExpenseSplit {
  return {
    id: 's1',
    transaction_id: 't1',
    household_id: 'h1',
    shares: [],
    ...overrides,
  };
}

describe('splitWeighted (Issue #247)', () => {
  it('sollte gewichtet nach share aufteilen und cent-genau summieren (Invariante 6)', () => {
    const shares = splitWeighted(100, [
      { id: 'a', share: 3 },
      { id: 'b', share: 1 },
    ]);
    expect(shares).toEqual([
      { member_id: 'a', amount: 75 },
      { member_id: 'b', amount: 25 },
    ]);
    const sum = shares.reduce((s, x) => s + Math.round(x.amount * 100), 0);
    expect(sum).toBe(10000);
  });

  it('sollte den Rundungsrest per Largest-Remainder verteilen (Summe exakt)', () => {
    const shares = splitWeighted(100, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]); // 3-tel
    const sum = shares.reduce((s, x) => s + Math.round(x.amount * 100), 0);
    expect(sum).toBe(10000); // 3334 + 3333 + 3333
  });
});

describe('computeMemberBalances (Issue #247)', () => {
  it('sollte den Zahler gutschreiben und jedem seinen Anteil als Schuld anlasten', () => {
    // Anna zahlt 40 €, aufgeteilt 20/20 auf Anna und Ben.
    const balances = computeMemberBalances([
      split({ paid_by_member_id: 'a', shares: splitEqually(40, ['a', 'b']) }),
    ]);
    // Anna: +40 ausgelegt − 20 Anteil = +20; Ben: −20.
    expect(balances).toEqual([
      { member_id: 'a', balance_minor: 2000 },
      { member_id: 'b', balance_minor: -2000 },
    ]);
  });

  it('sollte Splits ohne Ist-Zahler ignorieren (reine Kostenaufteilung)', () => {
    const balances = computeMemberBalances([split({ shares: splitEqually(40, ['a', 'b']) })]);
    expect(balances).toEqual([]);
  });

  it('sollte die Summe aller Salden exakt bei 0 halten', () => {
    const balances = computeMemberBalances([
      split({ id: 's1', paid_by_member_id: 'a', shares: splitWeighted(100, [{ id: 'a', share: 1 }, { id: 'b', share: 1 }, { id: 'c', share: 1 }]) }),
      split({ id: 's2', transaction_id: 't2', paid_by_member_id: 'b', shares: splitEqually(30, ['a', 'b', 'c']) }),
    ]);
    const sum = balances.reduce((s, b) => s + b.balance_minor, 0);
    expect(sum).toBe(0);
  });

  it('sollte Ausgleichsbuchungen den Saldo zurückverschieben lassen', () => {
    const splits = [split({ paid_by_member_id: 'a', shares: splitEqually(40, ['a', 'b']) })];
    // Ben (schuldet 20) gleicht 20 € an Anna aus.
    const balances = computeMemberBalances(splits, [
      { from_member_id: 'b', to_member_id: 'a', amount_minor: 2000 },
    ]);
    expect(balances).toEqual([
      { member_id: 'a', balance_minor: 0 },
      { member_id: 'b', balance_minor: 0 },
    ]);
  });
});

describe('computeDebts (wer schuldet wem, Issue #247)', () => {
  it('sollte einen minimalen Ausgleichsplan erzeugen', () => {
    // a +30, b +10, c −40  ⇒ c zahlt 30 an a und 10 an b.
    const debts = computeDebts([
      { member_id: 'a', balance_minor: 3000 },
      { member_id: 'b', balance_minor: 1000 },
      { member_id: 'c', balance_minor: -4000 },
    ]);
    expect(debts).toEqual([
      { from_member_id: 'c', to_member_id: 'a', amount_minor: 3000 },
      { from_member_id: 'c', to_member_id: 'b', amount_minor: 1000 },
    ]);
  });

  it('sollte bei ausgeglichenen Salden keinen Transfer erzeugen', () => {
    expect(computeDebts([
      { member_id: 'a', balance_minor: 0 },
      { member_id: 'b', balance_minor: 0 },
    ])).toEqual([]);
  });

  it('sollte die Summe der Transfers der Gesamtschuld entsprechen', () => {
    const debts = computeDebts([
      { member_id: 'a', balance_minor: 5000 },
      { member_id: 'b', balance_minor: -2000 },
      { member_id: 'c', balance_minor: -3000 },
    ]);
    const sum = debts.reduce((s, d) => s + d.amount_minor, 0);
    expect(sum).toBe(5000);
  });
});
