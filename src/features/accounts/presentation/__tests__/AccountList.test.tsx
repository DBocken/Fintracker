/**
 * Kontenliste der Konten-Slice (WP 6.5a).
 *
 * Die Liste bekommt fertige Zeilenmodelle und hat selbst keinen Datenzugriff
 * mehr — genau das macht eine zweite Praesentation (Mobile) moeglich, ohne die
 * Datenbeschaffung ein zweites Mal zu schreiben (AGENTS.md §4).
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import type { Account } from '@/lib/account-types';
import type { AccountRowModel } from '../../application/use-account-manager';
import { AccountList } from '../AccountList';

function konto(overrides: Partial<Account> = {}): Account {
  return {
    id: 'a1',
    user_id: 'u1',
    name: 'Hauptkonto',
    type: 'checking',
    currency: 'EUR',
    color: '#1d5c54',
    icon: '🏦',
    is_budget_pool_member: false,
    order_index: 0,
    ...overrides,
  } as Account;
}

function zeile(overrides: Partial<AccountRowModel> = {}): AccountRowModel {
  return {
    account: konto(),
    typeLabel: 'Girokonto',
    quality: {
      accountId: 'a1',
      status: 'good',
      label: 'gut',
      score: 90,
      description: 'Alles da',
      issues: [],
    },
    isConnected: false,
    consentExpired: false,
    consentExpiresSoon: false,
    consentExpiresAt: null,
    syncStatusText: 'Nicht verbunden',
    canSync: false,
    isSyncing: false,
    ...overrides,
  };
}

const HANDLER = {
  onEdit: () => {},
  onDelete: () => {},
  onSync: () => {},
  onDisconnect: () => {},
};

describe('AccountList', () => {
  it('sollte Name, Typ und Waehrung eines Kontos zeigen', () => {
    renderWithI18n(<AccountList rows={[zeile()]} isEmpty={false} {...HANDLER} />);

    expect(screen.getByText('Hauptkonto')).toBeTruthy();
    expect(screen.getByText(/Girokonto/)).toBeTruthy();
    expect(screen.getByText('EUR')).toBeTruthy();
  });

  it('sollte einen leeren Bestand als solchen benennen', () => {
    renderWithI18n(<AccountList rows={[]} isEmpty {...HANDLER} />);

    expect(screen.getByText('Noch keine Konten angelegt')).toBeTruthy();
  });

  it('sollte bei ungeklaertem Bestand WEDER Liste NOCH Leertext zeigen', () => {
    // Der Fall nach einem Lesefehler: nichts gelesen, also nichts behaupten.
    renderWithI18n(<AccountList rows={[]} isEmpty={false} {...HANDLER} />);

    expect(screen.queryByText('Noch keine Konten angelegt')).toBeNull();
  });

  it('sollte den Leerzustand auf Englisch benennen', () => {
    renderWithI18n(<AccountList rows={[]} isEmpty {...HANDLER} />, 'en');

    expect(screen.getByText('No accounts yet')).toBeTruthy();
  });

  it('sollte fuer ein verbundenes Konto Synchronisieren und Trennen anbieten, nicht Loeschen', () => {
    renderWithI18n(
      <AccountList
        rows={[
          zeile({
            account: konto({ gocardless_account_id: 'gc1' }),
            isConnected: true,
            canSync: true,
            syncStatusText: 'Gerade eben',
          }),
        ]}
        isEmpty={false}
        {...HANDLER}
      />,
    );

    expect(screen.getByRole('button', { name: 'Transaktionen synchronisieren' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bankverbindung trennen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Konto löschen' })).toBeNull();
  });

  it('sollte fuer ein nicht verbundenes Konto Loeschen anbieten', () => {
    const onDelete = vi.fn();
    renderWithI18n(
      <AccountList rows={[zeile()]} isEmpty={false} {...HANDLER} onDelete={onDelete} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Konto löschen' }));

    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
  });

  it('sollte abgelaufene und bald ablaufende Bankfreigaben unterschiedlich kennzeichnen', () => {
    const { unmount } = renderWithI18n(
      <AccountList
        rows={[zeile({ isConnected: true, consentExpired: true })]}
        isEmpty={false}
        {...HANDLER}
      />,
    );
    expect(screen.getByText('Verbindung abgelaufen')).toBeTruthy();
    unmount();

    renderWithI18n(
      <AccountList
        rows={[zeile({ isConnected: true, consentExpiresSoon: true })]}
        isEmpty={false}
        {...HANDLER}
      />,
    );
    expect(screen.getByText('Verbindung läuft bald ab')).toBeTruthy();
  });

  it('sollte ein gesperrtes Synchronisieren nicht anbieten', () => {
    renderWithI18n(
      <AccountList
        rows={[zeile({ isConnected: true, canSync: false })]}
        isEmpty={false}
        {...HANDLER}
      />,
    );

    const knopf = screen.getByRole('button', { name: 'Transaktionen synchronisieren' });
    expect(knopf.hasAttribute('disabled')).toBe(true);
  });
});
