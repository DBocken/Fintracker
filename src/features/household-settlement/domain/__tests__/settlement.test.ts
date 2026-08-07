import { describe, it, expect } from 'vitest';
import { settlementProgress, settlementTransactionIds } from '../balances';
import { splitEqually } from '@/services/household-service';
import type { SharedExpenseSplit } from '@/lib/household-types';
import { sumExpenses } from '@/lib/analysis-data';
import type { Transaction } from '@/types';

function split(overrides: Partial<SharedExpenseSplit>): SharedExpenseSplit {
  return { id: 's1', transaction_id: 't1', household_id: 'h1', shares: [], ...overrides };
}

describe('settlementProgress — Status (Issue #248)', () => {
  const splits = [split({ paid_by_member_id: 'a', shares: splitEqually(40, ['a', 'b']) })]; // Ben schuldet 20 €

  it('sollte ohne Ausgleich „open" sein', () => {
    const p = settlementProgress(splits, []);
    expect(p.status).toBe('open');
    expect(p.remainingOwedMinor).toBe(2000);
  });

  it('sollte bei Teilzahlung „partial" sein', () => {
    const p = settlementProgress(splits, [
      { from_member_id: 'b', to_member_id: 'a', amount_minor: 1000 },
    ]);
    expect(p.status).toBe('partial');
    expect(p.remainingOwedMinor).toBe(1000);
  });

  it('sollte bei vollständigem Ausgleich „settled" sein', () => {
    const p = settlementProgress(splits, [
      { from_member_id: 'b', to_member_id: 'a', amount_minor: 2000 },
    ]);
    expect(p.status).toBe('settled');
    expect(p.remainingOwedMinor).toBe(0);
  });
});

describe('[INTEGRITY] Analytik-Ausschluss interner Ausgleiche (Issue #248, Invariante-2-analog)', () => {
  const tx = (id: string, amount: number): Transaction =>
    ({ id, amount, is_transfer: false }) as unknown as Transaction;

  it('sollte eine als Ausgleich verbuchte Transaktion aus der Konsumauswertung ausschließen', () => {
    const transactions = [tx('kauf', -50), tx('ausgleich-tx', -20)];
    const settlements = [
      { from_member_id: 'b', to_member_id: 'a', amount_minor: 2000, linked_transaction_id: 'ausgleich-tx' },
    ];

    const excluded = settlementTransactionIds(settlements);
    expect(excluded.has('ausgleich-tx')).toBe(true);

    // Ohne Ausschluss würde der interne Ausgleich doppelt als Ausgabe zählen.
    expect(sumExpenses(transactions)).toBe(70);
    // Mit Ausschluss zählt nur der echte Konsum.
    const bereinigt = transactions.filter((t) => !excluded.has(t.id ?? ''));
    expect(sumExpenses(bereinigt)).toBe(50);
  });

  it('sollte Ausgleiche ohne verknüpfte Transaktion (Barzahlung) nicht in die Ausschlussmenge nehmen', () => {
    const cashSettlements = [{ from_member_id: 'b', to_member_id: 'a', amount_minor: 2000 }];
    const excluded = settlementTransactionIds(cashSettlements);
    expect(excluded.size).toBe(0);
  });
});
