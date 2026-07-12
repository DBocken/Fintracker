import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '@/test-utils/render';
import type { Account, Transaction } from '@/types';
import { TransactionListMobile } from '../TransactionListMobile';

vi.mock('@/components/providers/GentleModeProvider', () => ({ useGentleMode: () => ({ enabled: false }) }));
vi.mock('@/services/account-service', () => ({ getAccounts: vi.fn() }));

import { getAccounts } from '@/services/account-service';

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

describe('[MOBILE] transaction row interaction', () => {
  it('öffnet Details über die vollständige Inhaltszeile', () => {
    const onOpenDetails = vi.fn();
    renderWithI18n(
      <TransactionListMobile
        transactions={[transaction]}
        categories={[]}
        accounts={ACCOUNTS}
        selected={new Set()}
        hiddenTransactions={new Set()}
        onSelect={vi.fn()}
        onOpenDetails={onOpenDetails}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /REWE/i }));
    expect(onOpenDetails).toHaveBeenCalledWith(transaction);
  });

  it('trennt Auswahl und Öffnen, damit ein Checkbox-Tap keine Details öffnet', () => {
    const onOpenDetails = vi.fn();
    const onSelect = vi.fn();
    renderWithI18n(
      <TransactionListMobile
        transactions={[transaction]}
        categories={[]}
        accounts={ACCOUNTS}
        selected={new Set()}
        hiddenTransactions={new Set()}
        onSelect={onSelect}
        onOpenDetails={onOpenDetails}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /Transaktion REWE auswählen/i }));
    expect(onSelect).toHaveBeenCalledWith('tx-1');
    expect(onOpenDetails).not.toHaveBeenCalled();
  });

  it('sollte englische Texte korrekt rendern', () => {
    renderWithI18n(
      <TransactionListMobile
        transactions={[transaction]}
        categories={[]}
        accounts={ACCOUNTS}
        selected={new Set()}
        hiddenTransactions={new Set()}
        onSelect={vi.fn()}
        onOpenDetails={vi.fn()}
      />,
      'en',
    );

    // Überprüfe dass englische Translations geladen sind
    expect(screen.getByRole('checkbox', { name: /Select transaction REWE/i })).toBeTruthy();
  });

  it('[REGRESSION] sollte keine eigene Konten-Query ausführen', () => {
    renderWithI18n(
      <TransactionListMobile
        transactions={[transaction]}
        categories={[]}
        accounts={ACCOUNTS}
        selected={new Set()}
        hiddenTransactions={new Set()}
        onSelect={vi.fn()}
        onOpenDetails={vi.fn()}
      />,
    );

    expect(getAccounts).not.toHaveBeenCalled();
  });
});
