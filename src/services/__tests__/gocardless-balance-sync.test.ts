import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Account, Transaction, UserSettings } from '@/types';

/**
 * Testet die Opening-Balance-Erfassung des echten `syncAccountTransactions`.
 *
 * Der vorherige Test in dieser Datei importierte nie den echten Sync-Service —
 * er rechnete die Arithmetik inline nach und verglich das Ergebnis mit sich
 * selbst. Eine Regression in `syncAccountTransactions` (z.B. falsches
 * Vorzeichen, falsche Sortierung nach Datum, oder ein bereits gesetztes
 * opening_balance wird versehentlich überschrieben) wäre damit nie
 * aufgefallen. Dieser Test ruft die Produktivfunktion mit gemockten
 * Abhängigkeiten (GoCardless-API, Storage-Services) auf.
 */

let mockGoCardlessTransactions: unknown[] = [];
let mockAccounts: Account[] = [];
let mockStoredTransactions: Transaction[] = [];

const { updateAccountMock, createTransactionMock } = vi.hoisted(() => ({
  updateAccountMock: vi.fn(),
  createTransactionMock: vi.fn(),
}));

updateAccountMock.mockImplementation(async (update: Partial<Account> & { id: string }) => {
  const acc = mockAccounts.find((a) => a.id === update.id);
  return { ...(acc as Account), ...update };
});
createTransactionMock.mockImplementation(async (tx: Partial<Transaction>) => ({
  id: crypto.randomUUID(),
  ...tx,
}) as Transaction);

vi.mock('../gocardless-service', () => ({
  gocardlessService: {
    getTransactions: vi.fn(() => Promise.resolve(mockGoCardlessTransactions)),
  },
}));

vi.mock('../account-service', () => ({
  getAccounts: vi.fn(() => Promise.resolve(mockAccounts)),
  updateAccount: updateAccountMock,
}));

vi.mock('../transaction-service', () => ({
  getTransactions: vi.fn(() => Promise.resolve(mockStoredTransactions)),
  getCategories: vi.fn(() => Promise.resolve([])),
  categorizeTransaction: vi.fn(() => null),
  getUserSettings: vi.fn(() => Promise.resolve({
    user_id: 'user-1',
    auto_confirm_mapping: false,
    retention_months: 24,
    enable_subcategories: true,
  } as UserSettings)),
  createTransaction: createTransactionMock,
  markTransferPair: vi.fn(() => Promise.resolve()),
}));

vi.mock('../merchant-rules-service', () => ({
  getMerchantRules: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../contract-detection-service', () => ({
  applyDetectedContracts: vi.fn(() => Promise.resolve(0)),
}));

import { syncAccountTransactions } from '../gocardless-sync-service';

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1',
    user_id: 'user-1',
    name: 'Test Account',
    type: 'checking',
    currency: 'EUR',
    color: '#000',
    icon: 'bank',
    is_budget_pool_member: false,
    order_index: 0,
    gocardless_account_id: 'gc-acc-1',
    gocardless_requisition_id: 'req-1',
    ...overrides,
  };
}

describe('syncAccountTransactions — opening balance capture', () => {
  beforeEach(() => {
    mockGoCardlessTransactions = [];
    mockAccounts = [];
    mockStoredTransactions = [];
    updateAccountMock.mockClear();
    createTransactionMock.mockClear();
  });

  it('erfasst opening_balance aus der einzigen Transaktion (balanceAfter - amount)', async () => {
    const acc = makeAccount();
    mockAccounts = [acc];
    mockGoCardlessTransactions = [
      {
        transactionId: 'txn-1',
        bookingDate: '2024-06-10',
        transactionAmount: { amount: '-100', currency: 'EUR' },
        debtorName: 'Test Merchant',
        remittanceInformationUnstructured: 'Test payment',
        balanceAfterTransaction: {
          balanceAmount: { amount: '900', currency: 'EUR' },
          balanceType: 'CLBD',
        },
      },
    ];

    const result = await syncAccountTransactions(acc);

    expect(result.errors).toEqual([]);
    expect(result.importedCount).toBe(1);
    expect(updateAccountMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'acc-1', opening_balance: 1000, opening_balance_date: '2024-06-10' }),
    );
  });

  it('nutzt bei mehreren Transaktionen die früheste (nach bookingDate) für opening_balance', async () => {
    const acc = makeAccount();
    mockAccounts = [acc];
    mockGoCardlessTransactions = [
      { transactionId: 't1', bookingDate: '2024-06-15', transactionAmount: { amount: '-100', currency: 'EUR' }, balanceAfterTransaction: { balanceAmount: { amount: '900', currency: 'EUR' }, balanceType: 'CLBD' } },
      { transactionId: 't2', bookingDate: '2024-06-14', transactionAmount: { amount: '-50', currency: 'EUR' }, balanceAfterTransaction: { balanceAmount: { amount: '950', currency: 'EUR' }, balanceType: 'CLBD' } },
      { transactionId: 't3', bookingDate: '2024-06-16', transactionAmount: { amount: '-75', currency: 'EUR' }, balanceAfterTransaction: { balanceAmount: { amount: '825', currency: 'EUR' }, balanceType: 'CLBD' } },
    ];

    await syncAccountTransactions(acc);

    expect(updateAccountMock).toHaveBeenCalledWith(
      expect.objectContaining({ opening_balance: 1000, opening_balance_date: '2024-06-14' }),
    );
  });

  it('[REGRESSION] überschreibt ein bereits gesetztes opening_balance nicht erneut', async () => {
    const acc = makeAccount({ opening_balance: 5000, opening_balance_date: '2024-01-01' });
    mockAccounts = [acc];
    mockGoCardlessTransactions = [
      { transactionId: 't1', bookingDate: '2024-06-10', transactionAmount: { amount: '-100', currency: 'EUR' }, balanceAfterTransaction: { balanceAmount: { amount: '900', currency: 'EUR' }, balanceType: 'CLBD' } },
    ];

    await syncAccountTransactions(acc);

    const call = updateAccountMock.mock.calls.at(-1)?.[0] as Partial<Account> | undefined;
    expect(call?.opening_balance).toBeUndefined();
    expect(call?.opening_balance_date).toBeUndefined();
  });

  it('setzt kein opening_balance, wenn keine Transaktion eine balanceAfterTransaction liefert', async () => {
    const acc = makeAccount();
    mockAccounts = [acc];
    mockGoCardlessTransactions = [
      { transactionId: 't1', bookingDate: '2024-06-10', transactionAmount: { amount: '-100', currency: 'EUR' } },
    ];

    await syncAccountTransactions(acc);

    const call = updateAccountMock.mock.calls.at(-1)?.[0] as Partial<Account> | undefined;
    expect(call?.opening_balance).toBeUndefined();
  });

  it('[REGRESSION] überspringt bereits importierte Buchungen (Dedupe) beim erneuten Sync', async () => {
    const acc = makeAccount();
    mockAccounts = [acc];
    const original_text = 'Test payment';
    mockStoredTransactions = [
      {
        id: 'existing-1', account_id: 'acc-1', date: '2024-06-10', amount: -100,
        payee: 'Test Merchant', description: original_text, original_text,
        auto_mapped: false, confirmed: false, currency: 'EUR',
      },
    ];
    mockGoCardlessTransactions = [
      {
        transactionId: 'txn-1', bookingDate: '2024-06-10',
        transactionAmount: { amount: '-100', currency: 'EUR' },
        debtorName: 'Test Merchant', remittanceInformationUnstructured: original_text,
      },
    ];

    const result = await syncAccountTransactions(acc);

    expect(result.importedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(createTransactionMock).not.toHaveBeenCalled();
  });

  it('meldet einen Fehler und bricht ab, wenn keine gocardless_requisition_id vorhanden ist', async () => {
    const acc = makeAccount({ gocardless_requisition_id: null });
    const result = await syncAccountTransactions(acc);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.importedCount).toBe(0);
    expect(updateAccountMock).not.toHaveBeenCalled();
  });
});
