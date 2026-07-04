import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Transaction } from '@/types';
import { TransactionDayList } from './TransactionDayList';

vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [] }) }));
vi.mock('@/components/providers/GentleModeProvider', () => ({ useGentleMode: () => ({ enabled: false }) }));
vi.mock('@/i18n/useI18n', () => ({ useI18n: () => ({ t: (_k: string, f?: string) => f ?? _k, locale: 'de' }) }));

function tx(p: Partial<Transaction> & { date: string; amount: number; id: string }): Transaction {
  return {
    payee: p.payee ?? 'Test',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...p,
  };
}

const NOW = new Date('2026-07-03T12:00:00');

describe('TransactionDayList', () => {
  describe('Normal Behavior', () => {
    it('sollte Tage gruppieren und den Kontostand je Tag als Kopfzeile zeigen', () => {
      render(
        <TransactionDayList
          transactions={[
            tx({ id: 'a', date: '2026-07-03', amount: -23.4, payee: 'Lieferando' }),
            tx({ id: 'b', date: '2026-07-02', amount: -53.16, payee: 'Rewe' }),
          ]}
          categories={[]}
          hiddenTransactions={new Set()}
          onOpenDetails={vi.fn()}
          endingBalance={1240}
          now={NOW}
        />,
      );

      expect(screen.getByText(/^Heute · /)).toBeTruthy();
      expect(screen.getByText(/^Gestern · /)).toBeTruthy();
      // Kontostand des jüngsten Tages = aktueller Gesamtsaldo.
      expect(screen.getByText('1.240,00 €')).toBeTruthy();
      // Kontostand des Vortags = 1240 - (-23.40) = 1263.40 (Tag 3 herausgerechnet).
      expect(screen.getByText('1.263,40 €')).toBeTruthy();
    });

    it('sollte den Tagessaldo mit Vorzeichen anzeigen', () => {
      render(
        <TransactionDayList
          transactions={[tx({ id: 'g', date: '2026-06-30', amount: 2180, payee: 'Gehalt' })]}
          categories={[]}
          hiddenTransactions={new Set()}
          onOpenDetails={vi.fn()}
          endingBalance={2180}
          now={NOW}
        />,
      );
      expect(screen.getByText('+2.180,00 €')).toBeTruthy();
    });

    it('sollte Details über die Zeile öffnen', () => {
      const onOpenDetails = vi.fn();
      const row = tx({ id: 'x', date: '2026-07-03', amount: -9, payee: 'Apotheke' });
      render(
        <TransactionDayList
          transactions={[row]}
          categories={[]}
          hiddenTransactions={new Set()}
          onOpenDetails={onOpenDetails}
          endingBalance={100}
          now={NOW}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /Apotheke/i }));
      expect(onOpenDetails).toHaveBeenCalledWith(row);
    });
  });

  describe('Edge Cases', () => {
    it('sollte die Kontostand-Kopfzeile ausblenden können', () => {
      render(
        <TransactionDayList
          transactions={[tx({ id: 'a', date: '2026-07-03', amount: -10, payee: 'X' })]}
          categories={[]}
          hiddenTransactions={new Set()}
          onOpenDetails={vi.fn()}
          endingBalance={1000}
          showRunningBalance={false}
          now={NOW}
        />,
      );
      expect(screen.queryByText('1.000,00 €')).toBeNull();
    });
  });
});
