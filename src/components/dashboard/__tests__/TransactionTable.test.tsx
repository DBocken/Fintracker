import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '@/test-utils/render';
import type { Account, Transaction } from '@/types';
import { TransactionTable } from '../TransactionTable';

vi.mock('@/components/providers/GentleModeProvider', () => ({ useGentleMode: () => ({ enabled: false }) }));
vi.mock('@/services/account-service', () => ({ getAccounts: vi.fn() }));

import { getAccounts } from '@/services/account-service';

const noop = () => {};

const transaction: Transaction = {
  id: 'tx-1',
  date: '2026-06-21',
  amount: -12.34,
  payee: 'REWE',
  description: 'Einkauf',
  original_text: 'REWE Einkauf',
  auto_mapped: false,
  confirmed: true,
};

const ACCOUNTS: Account[] = [];

function renderTable(locale: 'de' | 'en' = 'de') {
  return renderWithI18n(
    <TransactionTable
      transactions={[transaction]}
      categories={[]}
      accounts={ACCOUNTS}
      selected={new Set()}
      hiddenTransactions={new Set()}
      sortConfig={null}
      onSelect={noop}
      onToggleVisibility={noop}
      onUpdateCategory={noop}
      onDelete={noop}
      onSort={noop}
    />,
    locale,
  );
}

describe('TransactionTable', () => {
  it('sollte Buchungen mit Empfänger und Betrag rendern', () => {
    renderTable();
    expect(screen.getByText('REWE')).toBeTruthy();
    expect(screen.getByText('Empfänger')).toBeTruthy();
  });

  it('sollte englische Texte korrekt rendern', () => {
    renderTable('en');
    expect(screen.getByText('Payee')).toBeTruthy();
  });

  it('[REGRESSION] sollte keine eigene Konten-Query ausführen', () => {
    renderTable();
    expect(getAccounts).not.toHaveBeenCalled();
  });
});
