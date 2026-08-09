/**
 * ViewModel der Konten-Verwaltung (WP 6.5a, ARCH-1).
 *
 * `AccountManager` hielt bis hierher drei Abfragen, vier Mutationen und den
 * Wiederverbinden-Ablauf selbst. Die Zusicherungen sind beim Umzug dieselben
 * geblieben; dieser Test haelt sie an ihrem neuen Ort fest — allen voran die,
 * die eine falsche Auskunft verhindert: Ein Lesefehler darf NICHT als „noch
 * keine Konten" durchgehen.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createHookWrapper } from '@/test-utils/render';
import type { Account } from '@/lib/account-types';

const getAccounts = vi.fn();
const canCreateAccount = vi.fn();
const createAccount = vi.fn();
const updateAccount = vi.fn();
const deleteAccountService = vi.fn();
const getAccountConsentStatus = vi.fn();
const canSyncAccount = vi.fn();
const syncAccountTransactions = vi.fn();
const disconnectGoCardlessAccount = vi.fn();
const reconcileAllInternalTransfers = vi.fn();
const refreshBalances = vi.fn();
const reconnectBankConnection = vi.fn();
const showSuccess = vi.fn();
const showError = vi.fn();

vi.mock('@/services/account-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAccounts: () => getAccounts(),
  canCreateAccount: () => canCreateAccount(),
  createAccount: (input: unknown) => createAccount(input),
  updateAccount: (input: unknown) => updateAccount(input),
  deleteAccount: (id: string) => deleteAccountService(id),
}));

vi.mock('@/services/gocardless-sync-service', () => ({
  getAccountConsentStatus: (account: Account) => getAccountConsentStatus(account),
  canSyncAccount: (account: Account) => canSyncAccount(account),
  syncAccountTransactions: (account: Account) => syncAccountTransactions(account),
  disconnectGoCardlessAccount: (id: string) => disconnectGoCardlessAccount(id),
  reconcileAllInternalTransfers: () => reconcileAllInternalTransfers(),
}));

vi.mock('@/services/gocardless-service', () => ({
  gocardlessService: {
    reconnectBankConnection: (id: string, url: string) => reconnectBankConnection(id, url),
  },
}));

vi.mock('@/services/live-balance-service', () => ({
  refreshBalances: (mode: string) => refreshBalances(mode),
}));

vi.mock('@/utils/toast', () => ({
  showSuccess: (msg: string) => showSuccess(msg),
  showError: (msg: string) => showError(msg),
}));

import { useAccountManager } from '../use-account-manager';

function konto(overrides: Partial<Account> = {}): Account {
  return {
    id: 'a1',
    user_id: 'u1',
    name: 'Hauptkonto',
    type: 'checking',
    currency: 'EUR',
    color: '#1d5c54',
    icon: '🏦',
    is_budget_pool_member: true,
    order_index: 0,
    ...overrides,
  } as Account;
}

const VERBUNDEN = konto({
  id: 'a2',
  name: 'Bankkonto',
  gocardless_account_id: 'gc1',
  bank_connection_id: 'bc1',
  sync_enabled: true,
  last_sync_at: new Date().toISOString(),
});

describe('useAccountManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Der Reconnect-Ablauf legt die Requisition-Id ab; ohne Aufraeumen wuerde
    // der Sicherheitstest den Eintrag des vorigen Tests sehen und gruen sein,
    // ohne etwas zu pruefen.
    window.sessionStorage.clear();
    canSyncAccount.mockReturnValue({ canSync: true });
    getAccountConsentStatus.mockResolvedValue({ valid: true, expired: false });
    canCreateAccount.mockResolvedValue({ allowed: true, current: 1, limit: 5 });
    reconcileAllInternalTransfers.mockResolvedValue(undefined);
  });

  it('sollte je Konto ein Zeilenmodell mit Typ-Label, Datenqualitaet und Sync-Text liefern', async () => {
    getAccounts.mockResolvedValue([konto()]);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useAccountManager(), { wrapper });

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    const zeile = result.current.rows[0];
    expect(zeile.account.id).toBe('a1');
    expect(zeile.typeLabel).toBe('Girokonto');
    expect(zeile.isConnected).toBe(false);
    expect(zeile.syncStatusText).toBe('Nicht verbunden');
    expect(zeile.quality.score).toBeGreaterThanOrEqual(0);
  });

  it('sollte den Bestand erst dann leer nennen, wenn er GELESEN und leer ist', async () => {
    getAccounts.mockResolvedValue([]);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useAccountManager(), { wrapper });

    await waitFor(() => expect(result.current.isEmpty).toBe(true));
    expect(result.current.hasLoadError).toBe(false);
  });

  it('[REGRESSION] sollte einen Lesefehler melden und den Bestand NICHT leer nennen', async () => {
    getAccounts.mockRejectedValue(new Error('IndexedDB nicht erreichbar'));
    canCreateAccount.mockRejectedValue(new Error('IndexedDB nicht erreichbar'));
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useAccountManager(), { wrapper });

    await waitFor(() => expect(result.current.hasLoadError).toBe(true));
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.rows).toEqual([]);
  });

  it('sollte abgelaufene und bald ablaufende Bankfreigaben unterscheiden', async () => {
    getAccounts.mockResolvedValue([VERBUNDEN]);
    getAccountConsentStatus.mockResolvedValue({
      valid: false,
      expired: true,
      expiresAt: '2026-01-01T00:00:00.000Z',
      daysRemaining: -3,
    });
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useAccountManager(), { wrapper });

    await waitFor(() => expect(result.current.expiredConsentCount).toBe(1));
    expect(result.current.rows[0].consentExpired).toBe(true);
    expect(result.current.rows[0].consentExpiresSoon).toBe(false);
  });

  it('sollte ein neues Konto anlegen und danach die Flaeche benachrichtigen', async () => {
    getAccounts.mockResolvedValue([]);
    createAccount.mockResolvedValue(konto());
    const onSaved = vi.fn();
    const { wrapper, queryClient } = createHookWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAccountManager({ onSaved }), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.saveAccount({ name: 'Neu' }, null));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createAccount).toHaveBeenCalledWith({ name: 'Neu' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['accounts'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['account-limit'] });
  });

  it('sollte ein bestehendes Konto unter seiner ID aktualisieren', async () => {
    getAccounts.mockResolvedValue([konto()]);
    updateAccount.mockResolvedValue(konto({ name: 'Umbenannt' }));
    const onSaved = vi.fn();
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useAccountManager({ onSaved }), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    act(() => result.current.saveAccount({ name: 'Umbenannt' }, konto()));

    await waitFor(() => expect(updateAccount).toHaveBeenCalledWith({ name: 'Umbenannt', id: 'a1' }));
    expect(createAccount).not.toHaveBeenCalled();
  });

  it('sollte nach dem Speichern den Gesamtbestand auf interne Uebertraege pruefen', async () => {
    // Eine nachtraeglich gesetzte IBAN macht Bestandsbuchungen zu Uebertraegen;
    // ohne diesen Abgleich blieben sie fuer immer zwei einzelne Buchungen.
    getAccounts.mockResolvedValue([]);
    createAccount.mockResolvedValue(konto());
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useAccountManager(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.saveAccount({ name: 'Neu', iban: 'DE02120300000000202051' }, null));

    await waitFor(() => expect(reconcileAllInternalTransfers).toHaveBeenCalled());
  });

  it('sollte ein Konto loeschen', async () => {
    getAccounts.mockResolvedValue([konto()]);
    deleteAccountService.mockResolvedValue(undefined);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useAccountManager(), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    act(() => result.current.deleteAccount('a1'));

    await waitFor(() => expect(deleteAccountService).toHaveBeenCalledWith('a1'));
  });

  it('sollte nicht synchronisieren, solange die Bank noch sperrt — und sagen, warum', async () => {
    getAccounts.mockResolvedValue([VERBUNDEN]);
    canSyncAccount.mockReturnValue({ canSync: false, nextSyncIn: 'in 2 Stunden' });
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useAccountManager(), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    await act(async () => {
      await result.current.syncAccount(VERBUNDEN);
    });

    expect(syncAccountTransactions).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith('Synchronisation noch nicht möglich. in 2 Stunden');
  });

  it('sollte importierte Buchungen melden', async () => {
    getAccounts.mockResolvedValue([VERBUNDEN]);
    syncAccountTransactions.mockResolvedValue({ importedCount: 3, skippedCount: 1, errors: [] });
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useAccountManager(), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    await act(async () => {
      await result.current.syncAccount(VERBUNDEN);
    });

    expect(showSuccess).toHaveBeenCalledWith('3 neue Transaktionen von Bankkonto importiert');
  });

  it('sollte bei abgelaufener Freigabe die Bank neu verbinden statt die Salden zu aktualisieren', async () => {
    getAccounts.mockResolvedValue([VERBUNDEN]);
    getAccountConsentStatus.mockResolvedValue({ valid: false, expired: true, daysRemaining: -1 });
    reconnectBankConnection.mockResolvedValue({ id: 'req1', link: 'https://ob.gocardless.com/auth/req1' });
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useAccountManager(), { wrapper });
    await waitFor(() => expect(result.current.expiredConsentCount).toBe(1));

    await act(async () => {
      await result.current.refreshAll();
    });

    expect(reconnectBankConnection).toHaveBeenCalled();
    expect(refreshBalances).not.toHaveBeenCalled();
  });

  it('[SECURITY] sollte einen unsicheren Bank-Link nicht oeffnen', async () => {
    getAccounts.mockResolvedValue([VERBUNDEN]);
    getAccountConsentStatus.mockResolvedValue({ valid: false, expired: true, daysRemaining: -1 });
    reconnectBankConnection.mockResolvedValue({ id: 'req1', link: 'javascript:alert(1)' });
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useAccountManager(), { wrapper });
    await waitFor(() => expect(result.current.expiredConsentCount).toBe(1));

    await act(async () => {
      await result.current.refreshAll();
    });

    expect(showError).toHaveBeenCalledWith(
      'Der Bank-Link wurde blockiert, weil er nicht sicher ist. Bitte verbinde die Bank neu.',
    );
    expect(window.sessionStorage.getItem('gocardless_requisition_id')).toBeNull();
  });

  it('sollte ohne abgelaufene Freigabe die Salden manuell aktualisieren', async () => {
    getAccounts.mockResolvedValue([VERBUNDEN]);
    refreshBalances.mockResolvedValue({ success: true, message: 'Salden aktualisiert' });
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useAccountManager(), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    await act(async () => {
      await result.current.refreshAll();
    });

    await waitFor(() => expect(refreshBalances).toHaveBeenCalledWith('manual'));
  });

  it('sollte die Bankverbindung trennen und die betroffenen Abfragen erneuern', async () => {
    getAccounts.mockResolvedValue([VERBUNDEN]);
    disconnectGoCardlessAccount.mockResolvedValue(undefined);
    const { wrapper, queryClient } = createHookWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAccountManager(), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    await act(async () => {
      await result.current.disconnectAccount(VERBUNDEN);
    });

    expect(disconnectGoCardlessAccount).toHaveBeenCalledWith('a2');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['account-consent-statuses'] });
    expect(showSuccess).toHaveBeenCalledWith('Bankverbindung getrennt');
  });

  it('sollte die Uebertrags-Vorschlaege erst ab zwei Konten anbieten', async () => {
    getAccounts.mockResolvedValue([konto()]);
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useAccountManager(), { wrapper });

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.showTransferSuggestions).toBe(false);
  });
});
