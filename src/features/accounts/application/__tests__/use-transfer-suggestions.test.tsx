/**
 * ViewModel der Uebertrags-Vorschlaege (WP 6.5a, ARCH-1).
 *
 * `TransferSuggestions` hielt zwei Abfragen und zwei Mutationen selbst. Beim
 * Umzug sind die Zusicherungen dieselben geblieben — inklusive der einen, die
 * eine falsche Auskunft verhindert: Ein Lesefehler darf nicht dazu fuehren,
 * dass die Karte verschwindet, als gaebe es nichts zu verknuepfen.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createHookWrapper } from '@/test-utils/render';
import type { Transaction } from '@/lib/transaction-types';
import type { Account } from '@/lib/account-types';
import { asTransactionId } from '@/lib/ids';

const getAccounts = vi.fn();
const getTransactions = vi.fn();
const markTransferPair = vi.fn();
const unmarkTransfer = vi.fn();
const showSuccess = vi.fn();
const showError = vi.fn();

vi.mock('@/services/account-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAccounts: () => getAccounts(),
}));

vi.mock('@/services/transaction-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getTransactions: (limit?: number) => getTransactions(limit),
  markTransferPair: (a: string, b: string) => markTransferPair(a, b),
  unmarkTransfer: (tx: Transaction) => unmarkTransfer(tx),
}));

vi.mock('@/utils/toast', () => ({
  showSuccess: (msg: string) => showSuccess(msg),
  showError: (msg: string) => showError(msg),
}));

import { useTransferSuggestions } from '../use-transfer-suggestions';

function konto(id: string, name: string): Account {
  return {
    id,
    user_id: 'u1',
    name,
    type: 'checking',
    currency: 'EUR',
    color: '#1d5c54',
    icon: '🏦',
    is_budget_pool_member: true,
    order_index: 0,
  } as Account;
}

function buchung(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: asTransactionId(id),
    user_id: 'u1',
    amount: -100,
    description: 'Übertrag',
    date: '2026-08-01',
    type: 'expense',
    account_id: 'a1',
    ...overrides,
  } as Transaction;
}

const KONTEN = [konto('a1', 'Girokonto'), konto('a2', 'Sparkonto')];

describe('useTransferSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAccounts.mockResolvedValue(KONTEN);
  });

  it('sollte ein erkanntes Kandidatenpaar mit beiden Kontonamen liefern', async () => {
    getTransactions.mockResolvedValue([
      buchung('t1', { amount: -100, account_id: 'a1' }),
      buchung('t2', { amount: 100, account_id: 'a2' }),
    ]);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useTransferSuggestions(), { wrapper });

    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    const kandidat = result.current.candidates[0];
    expect(kandidat.fromLabel).toBe('🏦 Girokonto');
    expect(kandidat.toLabel).toBe('🏦 Sparkonto');
    expect(kandidat.amount).toBe(-100);
  });

  it('sollte ein bereits verknuepftes Paar genau einmal auffuehren', async () => {
    getTransactions.mockResolvedValue([
      buchung('t1', { is_transfer: true, transfer_pair_id: 't2' }),
      buchung('t2', { is_transfer: true, transfer_pair_id: 't1', account_id: 'a2', amount: 100 }),
    ]);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useTransferSuggestions(), { wrapper });

    await waitFor(() => expect(result.current.linked).toHaveLength(1));
    expect(result.current.linked[0].fromLabel).toBe('🏦 Girokonto');
    expect(result.current.linked[0].toLabel).toBe('🏦 Sparkonto');
  });

  it('sollte eine verknuepfte Buchung ohne auffindbare Gegenbuchung als solche melden', async () => {
    getTransactions.mockResolvedValue([
      buchung('t1', { is_transfer: true, transfer_pair_id: 'weg' }),
    ]);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useTransferSuggestions(), { wrapper });

    await waitFor(() => expect(result.current.linked).toHaveLength(1));
    expect(result.current.linked[0].toLabel).toBeNull();
  });

  it('sollte ein unbekanntes Konto benennen statt es leer zu lassen', async () => {
    getAccounts.mockResolvedValue([]);
    getTransactions.mockResolvedValue([
      buchung('t1', { is_transfer: true, transfer_pair_id: 't2' }),
      buchung('t2', { is_transfer: true, transfer_pair_id: 't1', account_id: 'a2', amount: 100 }),
    ]);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useTransferSuggestions(), { wrapper });

    await waitFor(() => expect(result.current.linked).toHaveLength(1));
    expect(result.current.linked[0].fromLabel).toBe('Unbekanntes Konto');
  });

  it('[REGRESSION] sollte einen Lesefehler melden, statt die Karte stumm verschwinden zu lassen', async () => {
    getTransactions.mockRejectedValue(new Error('IndexedDB nicht erreichbar'));
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useTransferSuggestions(), { wrapper });

    await waitFor(() => expect(result.current.hasLoadError).toBe(true));
    expect(result.current.isEmpty).toBe(false);
  });

  it('sollte ohne Kandidaten und ohne Verknuepfungen nichts anzubieten haben', async () => {
    getTransactions.mockResolvedValue([]);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useTransferSuggestions(), { wrapper });

    await waitFor(() => expect(result.current.isEmpty).toBe(true));
  });

  it('sollte ein Paar als Uebertrag verknuepfen', async () => {
    getTransactions.mockResolvedValue([
      buchung('t1', { amount: -100, account_id: 'a1' }),
      buchung('t2', { amount: 100, account_id: 'a2' }),
    ]);
    markTransferPair.mockResolvedValue(undefined);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useTransferSuggestions(), { wrapper });
    await waitFor(() => expect(result.current.candidates).toHaveLength(1));

    act(() => result.current.markAsTransfer(result.current.candidates[0].key));

    await waitFor(() => expect(markTransferPair).toHaveBeenCalledWith('t1', 't2'));
    expect(showSuccess).toHaveBeenCalledWith('Als interner Transfer markiert');
  });

  it('sollte eine Verknuepfung wieder loesen', async () => {
    getTransactions.mockResolvedValue([
      buchung('t1', { is_transfer: true, transfer_pair_id: 't2' }),
      buchung('t2', { is_transfer: true, transfer_pair_id: 't1', account_id: 'a2', amount: 100 }),
    ]);
    unmarkTransfer.mockResolvedValue(undefined);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useTransferSuggestions(), { wrapper });
    await waitFor(() => expect(result.current.linked).toHaveLength(1));

    act(() => result.current.unlink(result.current.linked[0].key));

    await waitFor(() => expect(unmarkTransfer).toHaveBeenCalled());
    expect(String(unmarkTransfer.mock.calls[0][0].id)).toBe('t1');
  });
});
