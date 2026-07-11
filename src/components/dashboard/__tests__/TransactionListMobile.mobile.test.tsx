import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/I18nProvider';
import { renderWithI18n } from '@/test-utils/render';
import type { Transaction } from '@/types';
import { TransactionListMobile } from '../TransactionListMobile';

vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [] }) }));
vi.mock('@/components/providers/GentleModeProvider', () => ({ useGentleMode: () => ({ enabled: false }) }));

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

describe('[MOBILE] transaction row interaction', () => {
  it('öffnet Details über die vollständige Inhaltszeile', () => {
    const onOpenDetails = vi.fn();
    renderWithI18n(
      <TransactionListMobile
        transactions={[transaction]}
        categories={[]}
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
    render(
      <I18nProvider initialLocale="en">
        <TransactionListMobile
          transactions={[transaction]}
          categories={[]}
          selected={new Set()}
          hiddenTransactions={new Set()}
          onSelect={vi.fn()}
          onOpenDetails={vi.fn()}
        />
      </I18nProvider>,
    );

    // Überprüfe dass englische Translations geladen sind
    expect(screen.getByRole('checkbox', { name: /Select transaction REWE/i })).toBeTruthy();
  });
});
