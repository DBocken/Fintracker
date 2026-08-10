/**
 * Umzugstest der Konten-Verwaltung (WP 6.5a, ARCH-1).
 *
 * Dieser Test entstand VOR dem Umbau und war vor ihm gruen. Genau das ist
 * seine Aufgabe: Ein Test, der erst nach dem Umzug gruen wird, prueft den
 * Umzug nicht — er prueft nur, dass er stattgefunden hat. Hier steht
 * stattdessen, WAS die Flaeche behauptet, und das muss vorher wie nachher
 * identisch sein.
 *
 * Die Zusicherungen sind bewusst die sichtbaren Aussagen (Kontoname, Typ,
 * Limit, abgelaufene Bankfreigabe, Leerzustand) und nicht die Bauform —
 * darunter darf sich alles aendern.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import type { Account } from '@/types';

const getAccounts = vi.fn();
const canCreateAccount = vi.fn();
const getAccountConsentStatus = vi.fn();
const canSyncAccount = vi.fn();

vi.mock('@/services/account-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAccounts: () => getAccounts(),
  canCreateAccount: () => canCreateAccount(),
}));

vi.mock('@/services/gocardless-sync-service', () => ({
  getAccountConsentStatus: (account: Account) => getAccountConsentStatus(account),
  canSyncAccount: (account: Account) => canSyncAccount(account),
  syncAccountTransactions: vi.fn(),
  disconnectGoCardlessAccount: vi.fn(),
  reconcileAllInternalTransfers: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/gocardless-service', () => ({
  gocardlessService: { reconnectBankConnection: vi.fn() },
}));

vi.mock('@/services/live-balance-service', () => ({
  refreshBalances: vi.fn(),
}));

// Die Bankanbindung ist eine eigene Flaeche mit eigenem Netzzugriff; sie
// gehoert nicht zu dem, was dieser Test zusichert.
vi.mock('@/components/GoCardlessConnect', () => ({
  GoCardlessConnect: () => null,
}));

vi.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({ status: 'authenticated' }),
}));

import { AccountManager } from '../AccountManager';

function konto(overrides: Partial<Account> = {}): Account {
  return {
    id: 'a1',
    user_id: 'u1',
    // Bewusst NICHT „Girokonto": das ist zugleich das Typ-Label, und ein Test,
    // der beides nicht auseinanderhalten kann, sichert keins von beidem zu.
    name: 'Hauptkonto',
    type: 'checking',
    currency: 'EUR',
    description: '',
    color: '#1d5c54',
    icon: '🏦',
    is_budget_pool_member: true,
    is_business: false,
    order_index: 0,
    opening_balance: 0,
    ...overrides,
  } as Account;
}

describe('AccountManager — sichtbare Aussagen der Konten-Verwaltung', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canSyncAccount.mockReturnValue({ canSync: true });
    getAccountConsentStatus.mockResolvedValue({ valid: true, expired: false });
    canCreateAccount.mockResolvedValue({ allowed: true, current: 1, limit: 5 });
  });

  it('sollte jedes Konto mit Name, Typ und Waehrung nennen', async () => {
    getAccounts.mockResolvedValue([
      konto(),
      konto({ id: 'a2', name: 'Sparkonto', type: 'savings', icon: '🐷' }),
    ]);

    renderWithProviders(<AccountManager />, { query: true });

    expect(await screen.findByText('Hauptkonto')).toBeTruthy();
    expect(screen.getByText('Sparkonto')).toBeTruthy();
    expect(screen.getAllByText('EUR')).toHaveLength(2);
    expect(screen.getByText(/Tagesgeld\/Sparkonto/)).toBeTruthy();
    expect(screen.getByText('1 von 5 Konten verwendet')).toBeTruthy();
  });

  it('[ZUSTAND /accounts:leer] sollte ohne Konten zum Anlegen einladen statt zu schweigen', async () => {
    getAccounts.mockResolvedValue([]);

    renderWithProviders(<AccountManager />, { query: true });

    expect(await screen.findByText('Noch keine Konten angelegt')).toBeTruthy();
    expect(screen.getByText('Erstelle dein erstes Konto, um Transaktionen zuzuordnen')).toBeTruthy();
  });

  it('[ZUSTAND /accounts:fehler] sollte einen Lesefehler benennen', async () => {
    getAccounts.mockRejectedValue(new Error('IndexedDB nicht erreichbar'));
    canCreateAccount.mockRejectedValue(new Error('IndexedDB nicht erreichbar'));

    renderWithProviders(<AccountManager />, { query: true });

    expect(
      await screen.findByText('Deine Daten konnten nicht geladen werden'),
    ).toBeTruthy();
  });

  /**
   * Beim Schreiben des Umzugstests aufgefallen und deshalb hier mitbehoben:
   * Der Lesefehler stand BISHER zusammen mit dem Leertext auf dem Schirm —
   * „Deine Daten konnten nicht geladen werden" UND „Noch keine Konten
   * angelegt". Das ist genau die Verwechslung, gegen die `check:state-coverage`
   * gebaut wurde (AGENTS.md §5): Der Nutzer liest, er habe nichts, obwohl
   * niemand nachsehen konnte. Unter `AccountsPage` blieb es unsichtbar, weil
   * die Seite bei einem Konten-Lesefehler vorher abbricht — sichtbar wird es,
   * sobald die Karte woanders steht oder nur eine der drei Abfragen scheitert.
   */
  it('[REGRESSION] [ZUSTAND /accounts:fehler] sollte nach einem Lesefehler NICHT „noch keine Konten" behaupten', async () => {
    getAccounts.mockRejectedValue(new Error('IndexedDB nicht erreichbar'));
    canCreateAccount.mockRejectedValue(new Error('IndexedDB nicht erreichbar'));

    renderWithProviders(<AccountManager />, { query: true });

    await screen.findByText('Deine Daten konnten nicht geladen werden');
    expect(screen.queryByText('Noch keine Konten angelegt')).toBeNull();
  });

  it('sollte das erreichte Konto-Limit benennen und die Anlage sperren', async () => {
    getAccounts.mockResolvedValue([konto()]);
    canCreateAccount.mockResolvedValue({ allowed: false, current: 3, limit: 3 });

    renderWithProviders(<AccountManager />, { query: true });

    expect(
      await screen.findByText('Du hast das Limit von 3 Konten erreicht. Upgrade auf Premium für unbegrenzte Konten.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /Neues Konto/ }).hasAttribute('disabled')).toBe(true);
  });

  it('sollte eine abgelaufene Bankfreigabe als Hinweis und als Badge zeigen', async () => {
    getAccounts.mockResolvedValue([
      konto({ gocardless_account_id: 'gc1', bank_connection_id: 'bc1', sync_enabled: true }),
    ]);
    getAccountConsentStatus.mockResolvedValue({
      valid: false,
      expired: true,
      expiresAt: '2026-01-01T00:00:00.000Z',
      daysRemaining: -3,
    });

    renderWithProviders(<AccountManager />, { query: true });

    expect(
      await screen.findByText(/Bei 1 Konto ist die Bankverbindung abgelaufen/),
    ).toBeTruthy();
    expect(screen.getByText('Verbindung abgelaufen')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bankverbindung trennen' })).toBeTruthy();
  });

  it('sollte eine bald ablaufende Bankfreigabe getrennt von einer abgelaufenen kennzeichnen', async () => {
    getAccounts.mockResolvedValue([
      konto({ gocardless_account_id: 'gc1', bank_connection_id: 'bc1', sync_enabled: true }),
    ]);
    getAccountConsentStatus.mockResolvedValue({
      valid: true,
      expired: false,
      expiresAt: '2026-09-01T00:00:00.000Z',
      daysRemaining: 5,
    });

    renderWithProviders(<AccountManager />, { query: true });

    expect(await screen.findByText('Verbindung läuft bald ab')).toBeTruthy();
    expect(screen.queryByText('Verbindung abgelaufen')).toBeNull();
  });

  it('sollte die Konten-Verwaltung auf Englisch benennen', async () => {
    getAccounts.mockResolvedValue([konto()]);

    renderWithProviders(<AccountManager />, { query: true, locale: 'en' });

    expect(await screen.findByText('Manage accounts')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('1 of 5 accounts used')).toBeTruthy());
    expect(screen.getByRole('button', { name: /New account/ })).toBeTruthy();
  });
});
