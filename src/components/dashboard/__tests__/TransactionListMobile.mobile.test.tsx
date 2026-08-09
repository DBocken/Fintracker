import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '@/test-utils/render';
import type { Account, Transaction } from '@/types';
import { TransactionListMobile } from '../TransactionListMobile';
import { buildDayGroups, formatDayHeading } from '../transaction-day-groups';

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

// WP 5.5 / KOMP-3: Die Tagesgruppierung existierte zweimal mit sichtbar
// anderem Ergebnis (eigenes `reduce` ohne Relativierung vs. `buildDayGroups`/
// `formatDayHeading` mit „Heute/Gestern"). Diese Suite prüft den konsolidierten
// Kopf und dass dieselben Buchungen dieselben Gruppen ergeben wie
// `buildDayGroups` direkt.
describe('[MOBILE] Tageskopf (WP 5.5 / KOMP-3)', () => {
  const now = new Date('2026-07-03T12:00:00');
  const today: Transaction = { ...transaction, id: 'tx-today', date: '2026-07-03', payee: 'Lieferando' };
  const yesterday: Transaction = { ...transaction, id: 'tx-yesterday', date: '2026-07-02', payee: 'Rewe' };

  it('sollte den Tageskopf bilingual mit „Heute"/„Gestern" bzw. „Today"/„Yesterday" zeigen', () => {
    const { unmount } = renderWithI18n(
      <TransactionListMobile
        transactions={[today, yesterday]}
        categories={[]}
        accounts={ACCOUNTS}
        selected={new Set()}
        hiddenTransactions={new Set()}
        onSelect={vi.fn()}
        onOpenDetails={vi.fn()}
        now={now}
      />,
      'de',
    );
    expect(screen.getByText(/^Heute · /)).toBeTruthy();
    expect(screen.getByText(/^Gestern · /)).toBeTruthy();
    unmount();

    renderWithI18n(
      <TransactionListMobile
        transactions={[today, yesterday]}
        categories={[]}
        accounts={ACCOUNTS}
        selected={new Set()}
        hiddenTransactions={new Set()}
        onSelect={vi.fn()}
        onOpenDetails={vi.fn()}
        now={now}
      />,
      'en',
    );
    expect(screen.getByText(/^Today · /)).toBeTruthy();
    expect(screen.getByText(/^Yesterday · /)).toBeTruthy();
  });

  it('sollte ein älteres Datum weiterhin als Datum zeigen, nicht als „Heute"/„Gestern"', () => {
    const older: Transaction = { ...transaction, id: 'tx-older', date: '2026-06-20', payee: 'Miete' };
    renderWithI18n(
      <TransactionListMobile
        transactions={[older]}
        categories={[]}
        accounts={ACCOUNTS}
        selected={new Set()}
        hiddenTransactions={new Set()}
        onSelect={vi.fn()}
        onOpenDetails={vi.fn()}
        now={now}
      />,
    );

    expect(screen.queryByText(/Heute|Gestern/)).toBeNull();
    expect(screen.getByText(/20\.6\./)).toBeTruthy();
  });

  it('[REGRESSION] sollte dieselben Buchungen zu denselben Tagesgruppen zusammenfassen wie buildDayGroups', () => {
    const transactions: Transaction[] = [
      today,
      yesterday,
      { ...transaction, id: 'tx-yesterday-2', date: '2026-07-02', payee: 'Bäckerei' },
      { ...transaction, id: 'tx-june', date: '2026-06-30', payee: 'Gehalt' },
    ];
    const expectedGroups = buildDayGroups(transactions, 0);

    const { container } = renderWithI18n(
      <TransactionListMobile
        transactions={transactions}
        categories={[]}
        accounts={ACCOUNTS}
        selected={new Set()}
        hiddenTransactions={new Set()}
        onSelect={vi.fn()}
        onOpenDetails={vi.fn()}
        now={now}
      />,
    );

    const headings = Array.from(container.querySelectorAll('h3')).map((el) => el.textContent);
    expect(headings).toEqual(expectedGroups.map((g) => formatDayHeading(g.key, now)));

    const sections = container.querySelectorAll('section');
    expect(sections.length).toBe(expectedGroups.length);
    sections.forEach((section, index) => {
      expect(section.querySelectorAll('li').length).toBe(expectedGroups[index].items.length);
    });
  });
});
