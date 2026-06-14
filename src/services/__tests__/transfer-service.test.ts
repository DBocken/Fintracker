import { describe, it, expect } from 'vitest';
import { findTransferCandidates } from '../transfer-service';
import type { Transaction } from '../../types';

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    date: '2026-06-01',
    amount: 0,
    payee: 'Test',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...overrides,
  };
}

describe('findTransferCandidates', () => {
  it('matches an outgoing and incoming transaction on different accounts', () => {
    const transactions: Transaction[] = [
      makeTx({ id: 'a', account_id: 'acc1', amount: -100, date: '2026-06-01' }),
      makeTx({ id: 'b', account_id: 'acc2', amount: 100, date: '2026-06-02' }),
    ];

    const candidates = findTransferCandidates(transactions);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].outgoing.id).toBe('a');
    expect(candidates[0].incoming.id).toBe('b');
    expect(candidates[0].daysApart).toBe(1);
  });

  it('does not match transactions on the same account', () => {
    const transactions: Transaction[] = [
      makeTx({ id: 'a', account_id: 'acc1', amount: -100, date: '2026-06-01' }),
      makeTx({ id: 'b', account_id: 'acc1', amount: 100, date: '2026-06-01' }),
    ];

    expect(findTransferCandidates(transactions)).toHaveLength(0);
  });

  it('does not match transactions with different amounts', () => {
    const transactions: Transaction[] = [
      makeTx({ id: 'a', account_id: 'acc1', amount: -100, date: '2026-06-01' }),
      makeTx({ id: 'b', account_id: 'acc2', amount: 50, date: '2026-06-01' }),
    ];

    expect(findTransferCandidates(transactions)).toHaveLength(0);
  });

  it('does not match transactions more than 2 days apart', () => {
    const transactions: Transaction[] = [
      makeTx({ id: 'a', account_id: 'acc1', amount: -100, date: '2026-06-01' }),
      makeTx({ id: 'b', account_id: 'acc2', amount: 100, date: '2026-06-05' }),
    ];

    expect(findTransferCandidates(transactions)).toHaveLength(0);
  });

  it('ignores transactions already marked as transfers', () => {
    const transactions: Transaction[] = [
      makeTx({ id: 'a', account_id: 'acc1', amount: -100, date: '2026-06-01', is_transfer: true }),
      makeTx({ id: 'b', account_id: 'acc2', amount: 100, date: '2026-06-01' }),
    ];

    expect(findTransferCandidates(transactions)).toHaveLength(0);
  });
});
