import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Account, Transaction, UserSettings } from '@/types';
import { asTransactionId } from '@/lib/ids';

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

const { updateAccountMock, createTransactionMock, getBankBalanceMock } = vi.hoisted(() => ({
  updateAccountMock: vi.fn(),
  createTransactionMock: vi.fn(),
  getBankBalanceMock: vi.fn(),
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
  getAllTransactions: vi.fn(() => Promise.resolve(mockStoredTransactions)),
  getCategories: vi.fn(() => Promise.resolve([])),
  categorizeTransaction: vi.fn(() => null),
  categorizeTransactionConfident: vi.fn(() => null),
  getUserSettings: vi.fn(() => Promise.resolve({
    user_id: 'user-1',
    auto_confirm_mapping: false,
    retention_months: 24,
    enable_subcategories: true,
  } as UserSettings)),
  createTransaction: createTransactionMock,
  markTransferPair: vi.fn(() => Promise.resolve()),
}));

vi.mock('../live-balance-service', () => ({
  getBankBalanceForAccount: getBankBalanceMock,
}));

vi.mock('../merchant-rules-service', () => ({
  getMerchantRules: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../contract-detection-service', () => ({
  applyDetectedContracts: vi.fn(() => Promise.resolve(0)),
}));

import { syncAccountTransactions } from '../gocardless-sync-service';

/** Der Aufruf, der `last_sync_at` fortschreibt — die Konto-Aktualisierung des Imports. */
function accountUpdateCall(): (Partial<Account> & { id: string }) | undefined {
  return updateAccountMock.mock.calls
    .map((c) => c[0] as Partial<Account> & { id: string })
    .find((c) => c.last_sync_at !== undefined);
}

/** Der Aufruf, der den Saldo-Anker schreibt. */
function anchorUpdateCall(): (Partial<Account> & { id: string }) | undefined {
  return updateAccountMock.mock.calls
    .map((c) => c[0] as Partial<Account> & { id: string })
    .find((c) => c.live_balance_amount !== undefined);
}

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
    // Voreinstellung: Die Bank gibt keinen Saldo heraus. Die Tests, die den
    // Anker prüfen, setzen ihn ausdrücklich.
    getBankBalanceMock.mockReset();
    getBankBalanceMock.mockResolvedValue(null);
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

    const call = accountUpdateCall();
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

    const call = accountUpdateCall();
    expect(call?.opening_balance).toBeUndefined();
  });

  it('[REGRESSION] überspringt bereits importierte Buchungen (Dedupe) beim erneuten Sync', async () => {
    const acc = makeAccount();
    mockAccounts = [acc];
    const original_text = 'Test payment';
    mockStoredTransactions = [
      {
        id: asTransactionId('existing-1'), account_id: 'acc-1', date: '2024-06-10', amount: -100,
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
  it('[REGRESSION] setzt beim INKREMENTELLEN Sync kein opening_balance mehr', async () => {
    // Der Kern des gemeldeten Fehlers: `!account.opening_balance` war bei dem
    // von `createAccount` vergebenen Wert 0 immer wahr, und das Sync-Fenster
    // beginnt ab dem zweiten Lauf bei `last_sync_at`. Der zurueckgerechnete
    // Wert war damit der Saldo vor einem beliebigen Zwischenstand — waehrend
    // die gesamte Historie weiter daraufaddiert wurde.
    const acc = makeAccount({ opening_balance: 0, last_sync_at: '2024-06-01T00:00:00.000Z' });
    mockAccounts = [acc];
    mockGoCardlessTransactions = [
      { transactionId: 't1', bookingDate: '2024-06-10', transactionAmount: { amount: '-100', currency: 'EUR' }, balanceAfterTransaction: { balanceAmount: { amount: '900', currency: 'EUR' }, balanceType: 'CLBD' } },
    ];

    await syncAccountTransactions(acc);

    const call = accountUpdateCall();
    expect(call?.opening_balance).toBeUndefined();
    expect(call?.opening_balance_date).toBeUndefined();
  });

  it('[REGRESSION] schreibt den echten Bankstand mit dem Stichtag der Bank als Anker', async () => {
    const acc = makeAccount();
    mockAccounts = [acc];
    getBankBalanceMock.mockResolvedValue({
      amount: 1234.56,
      currency: 'EUR',
      balanceType: 'closingBooked',
      referenceDate: '2024-06-20',
    });
    mockGoCardlessTransactions = [
      { transactionId: 't1', bookingDate: '2024-06-10', transactionAmount: { amount: '-100', currency: 'EUR' } },
    ];

    await syncAccountTransactions(acc);

    expect(anchorUpdateCall()).toEqual({
      id: 'acc-1',
      live_balance_amount: 1234.56,
      live_balance_currency: 'EUR',
      live_balance_type: 'closingBooked',
      live_balance_updated_at: '2024-06-20',
    });
  });

  it('zieht den Saldo-Anker auch dann nach, wenn die Bank keine neue Buchung liefert', async () => {
    const acc = makeAccount();
    mockAccounts = [acc];
    getBankBalanceMock.mockResolvedValue({
      amount: 42,
      currency: 'EUR',
      balanceType: 'closingBooked',
      referenceDate: '2024-06-21',
    });
    mockGoCardlessTransactions = [];

    await syncAccountTransactions(acc);

    expect(anchorUpdateCall()?.live_balance_amount).toBe(42);
  });

  it('bricht den Import nicht ab, wenn der Saldo-Abruf scheitert', async () => {
    const acc = makeAccount();
    mockAccounts = [acc];
    getBankBalanceMock.mockRejectedValue(new Error('Bank nicht erreichbar'));
    mockGoCardlessTransactions = [
      { transactionId: 't1', bookingDate: '2024-06-10', transactionAmount: { amount: '-100', currency: 'EUR' } },
    ];

    const result = await syncAccountTransactions(acc);

    expect(result.errors).toEqual([]);
    expect(result.importedCount).toBe(1);
    expect(anchorUpdateCall()).toBeUndefined();
  });
  it('[REGRESSION] weist bei einer Kartenzahlung den Haendler als Empfaenger aus, nicht die abwickelnde Stelle', async () => {
    const acc = makeAccount();
    mockAccounts = [acc];
    mockGoCardlessTransactions = [
      {
        transactionId: 'gc-parken',
        bookingDate: '2026-08-19',
        valueDate: '2026-08-19',
        transactionAmount: { amount: '-2.30', currency: 'EUR' },
        debtorName: 'Landesbank Hessen-Thueringen',
        creditorName: 'Parken - Rathaus//Wolfsburg/DE',
        debtorAccount: { iban: 'DE00EIGENES00000000000' },
        creditorAccount: { iban: 'DE56500500000959563149' },
        remittanceInformationUnstructured: 'KARTENZAHLUNG',
        merchantCategoryCode: '7523',
        bankTransactionCode: 'PMNT-CCRD-POSD',
      },
    ];

    await syncAccountTransactions(acc);

    const created = createTransactionMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(created.payee).toBe('Parken - Rathaus//Wolfsburg/DE');
    expect(created.counterparty_iban).toBe('DE56500500000959563149');
  });

  it('[REGRESSION] behaelt jedes gelieferte Bankfeld statt es beim Import zu verwerfen', async () => {
    const acc = makeAccount();
    mockAccounts = [acc];
    mockGoCardlessTransactions = [
      {
        transactionId: 'gc-parken',
        bookingDate: '2026-08-19',
        valueDate: '2026-08-20',
        transactionAmount: { amount: '-2.30', currency: 'EUR' },
        creditorName: 'Parken - Rathaus//Wolfsburg/DE',
        remittanceInformationUnstructured: 'KARTENZAHLUNG',
        merchantCategoryCode: '7523',
        bankTransactionCode: 'PMNT-CCRD-POSD',
        mandateId: 'MND-1',
      },
    ];

    await syncAccountTransactions(acc);

    const created = createTransactionMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(created.value_date).toBe('2026-08-20');
    expect(created.bank_fields).toMatchObject({
      transactionId: 'gc-parken',
      valueDate: '2026-08-20',
      merchantCategoryCode: '7523',
      bankTransactionCode: 'PMNT-CCRD-POSD',
      mandateId: 'MND-1',
    });
  });

  it('nimmt die Art der Buchung als Beschreibung, wenn die Bank keinen Verwendungszweck liefert', async () => {
    const acc = makeAccount();
    mockAccounts = [acc];
    mockGoCardlessTransactions = [
      {
        transactionId: 'gc-1',
        bookingDate: '2026-08-19',
        transactionAmount: { amount: '-2.30', currency: 'EUR' },
        creditorName: 'Parken - Rathaus',
        merchantCategoryCode: '7523',
      },
    ];

    await syncAccountTransactions(acc);

    const created = createTransactionMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(created.description).toBe('Parken');
  });
});
