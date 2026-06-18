import { describe, it, expect } from 'vitest';
import {
  findTransferCandidates,
  normalizeIban,
  planInternalTransfers,
  type AccountIbanRef,
} from '../transfer-service';
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

describe('normalizeIban', () => {
  it('strips whitespace and uppercases', () => {
    expect(normalizeIban('de89 3704 0044 0532 0130 00')).toBe('DE89370400440532013000');
  });

  it('returns null for empty values', () => {
    expect(normalizeIban('')).toBeNull();
    expect(normalizeIban(null)).toBeNull();
    expect(normalizeIban(undefined)).toBeNull();
  });
});

describe('planInternalTransfers', () => {
  const GIRO = 'DE11111111111111111111';
  const TAGESGELD = 'DE22222222222222222222';

  const accounts: AccountIbanRef[] = [
    { id: 'giro', iban: GIRO, isLive: true },
    { id: 'tagesgeld', iban: TAGESGELD, isLive: false }, // CSV-Konto, nicht live
  ];

  it('plans a mirror booking on a non-live account when no counterpart exists', () => {
    // Gutschrift auf dem Giro, deren Gegenkonto-IBAN das Tagesgeldkonto ist.
    const incoming = makeTx({
      id: 'in',
      account_id: 'giro',
      amount: 100,
      date: '2026-06-10',
      counterparty_iban: 'DE22 2222 2222 2222 2222 22',
    });

    const plans = planInternalTransfers([incoming], [incoming], accounts);
    expect(plans).toHaveLength(1);
    expect(plans[0].counterAccountId).toBe('tagesgeld');
    expect(plans[0].existingCounterpart).toBeUndefined();
  });

  it('links to an existing counterpart instead of mirroring', () => {
    const incoming = makeTx({
      id: 'in',
      account_id: 'giro',
      amount: 100,
      date: '2026-06-10',
      counterparty_iban: TAGESGELD,
    });
    const existingOut = makeTx({
      id: 'out',
      account_id: 'tagesgeld',
      amount: -100,
      date: '2026-06-09',
    });

    const plans = planInternalTransfers([incoming], [incoming, existingOut], accounts);
    expect(plans).toHaveLength(1);
    expect(plans[0].existingCounterpart?.id).toBe('out');
  });

  it('does not mirror onto a live account without an existing counterpart', () => {
    const liveAccounts: AccountIbanRef[] = [
      { id: 'giro', iban: GIRO, isLive: true },
      { id: 'other', iban: TAGESGELD, isLive: true },
    ];
    const incoming = makeTx({
      id: 'in',
      account_id: 'giro',
      amount: 100,
      date: '2026-06-10',
      counterparty_iban: TAGESGELD,
    });

    expect(planInternalTransfers([incoming], [incoming], liveAccounts)).toHaveLength(0);
  });

  it('ignores transactions without a counterparty IBAN', () => {
    const incoming = makeTx({ id: 'in', account_id: 'giro', amount: 100, date: '2026-06-10' });
    expect(planInternalTransfers([incoming], [incoming], accounts)).toHaveLength(0);
  });

  it('ignores a counterparty IBAN that matches no own account', () => {
    const incoming = makeTx({
      id: 'in',
      account_id: 'giro',
      amount: 100,
      date: '2026-06-10',
      counterparty_iban: 'DE99999999999999999999',
    });
    expect(planInternalTransfers([incoming], [incoming], accounts)).toHaveLength(0);
  });

  it('ignores the IBAN of the own account (self-reference)', () => {
    const incoming = makeTx({
      id: 'in',
      account_id: 'giro',
      amount: 100,
      date: '2026-06-10',
      counterparty_iban: GIRO,
    });
    expect(planInternalTransfers([incoming], [incoming], accounts)).toHaveLength(0);
  });

  it('skips transactions already marked as transfers', () => {
    const incoming = makeTx({
      id: 'in',
      account_id: 'giro',
      amount: 100,
      date: '2026-06-10',
      counterparty_iban: TAGESGELD,
      is_transfer: true,
    });
    expect(planInternalTransfers([incoming], [incoming], accounts)).toHaveLength(0);
  });
});
