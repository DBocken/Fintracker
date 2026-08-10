import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '@/test-utils/render';
import type { Category, Transaction, TransactionAllocation } from '@/types';
import { asTransactionId } from '@/lib/ids';
import { TransactionDayList } from '../TransactionDayList';

vi.mock('@/components/providers/GentleModeProvider', () => ({ useGentleMode: () => ({ enabled: false }) }));

/**
 * Aufgeteilte Buchungen in der Übersicht: Die Buchung ist wie ein Akkordeon
 * aufklappbar und zeigt ihre Anteile als eingerückte Zeilen. Bei aktivem
 * Kategorie-Filter erscheint die passende Zeile direkt („Aldi └ Kleidung"),
 * damit ein Split unter der gefilterten Kategorie auffindbar ist.
 */

const NOW = new Date('2026-07-03T12:00:00');

const CATEGORIES: Category[] = [
  { id: 'food', name: 'Lebensmittel', parent_id: null } as Category,
  { id: 'clothes', name: 'Kleidung', parent_id: null } as Category,
];

const ALDI: Transaction = {
  id: asTransactionId('aldi'),
  date: '2026-07-03',
  amount: -50,
  payee: 'Aldi',
  description: '',
  original_text: '',
  auto_mapped: false,
  confirmed: true,
  category_id: 'food',
};

const CUA: Transaction = { ...ALDI, id: asTransactionId('cua'), payee: 'C&A', amount: -30, category_id: 'clothes' };

const ALDI_SPLITS: TransactionAllocation[] = [
  { id: 'a-food', transaction_id: 'aldi', amount_minor: -3700, category_id: 'food', source: 'manual' } as TransactionAllocation,
  {
    id: 'a-clothes',
    transaction_id: 'aldi',
    amount_minor: -1300,
    category_id: 'clothes',
    label: 'Socken',
    source: 'manual',
  } as TransactionAllocation,
];

const allocations = new Map<string, TransactionAllocation[]>([['aldi', ALDI_SPLITS]]);

function renderList(
  options: {
    matched?: Set<string>;
    transactions?: Transaction[];
    locale?: 'de' | 'en';
    onOpenDetails?: (tx: Transaction) => void;
  } = {},
) {
  return renderWithI18n(
    <TransactionDayList
      transactions={options.transactions ?? [ALDI, CUA]}
      categories={CATEGORIES}
      accounts={[]}
      hiddenTransactions={new Set()}
      onOpenDetails={options.onOpenDetails ?? vi.fn()}
      endingBalance={1000}
      allocationsByTransaction={allocations}
      matchedAllocationIds={options.matched ?? new Set()}
      now={NOW}
    />,
    options.locale ?? 'de',
  );
}

describe('TransactionDayList – aufgeteilte Buchungen', () => {
  describe('Normal Behavior', () => {
    it('sollte eine aufgeteilte Buchung als aufteilbar markieren und eingeklappt starten', () => {
      renderList();

      expect(screen.getByLabelText('aufgeteilt')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Aufteilung anzeigen' })).toBeTruthy();
      expect(screen.queryByText('Kleidung')).toBeNull();
    });

    it('sollte beim Aufklappen alle Anteile mit Kategorie, Notiz und Betrag zeigen', () => {
      renderList();

      fireEvent.click(screen.getByRole('button', { name: 'Aufteilung anzeigen' }));

      expect(screen.getByText('Lebensmittel')).toBeTruthy();
      expect(screen.getByText('Kleidung')).toBeTruthy();
      expect(screen.getByText('· Socken')).toBeTruthy();
      expect(screen.getByText('-37,00 €')).toBeTruthy();
      expect(screen.getByText('-13,00 €')).toBeTruthy();
      // Der Gesamtbetrag der Buchung bleibt sichtbar.
      expect(screen.getByText('-50,00 €')).toBeTruthy();
    });

    it('sollte wieder einklappen lassen', () => {
      renderList();

      fireEvent.click(screen.getByRole('button', { name: 'Aufteilung anzeigen' }));
      fireEvent.click(screen.getByRole('button', { name: 'Aufteilung ausblenden' }));

      expect(screen.queryByText('Kleidung')).toBeNull();
    });

    it('sollte Buchungen ohne Aufteilung unverändert lassen (kein Aufklapp-Button)', () => {
      renderList();

      const buttons = screen.getAllByRole('button', { name: /Aufteilung/ });
      expect(buttons).toHaveLength(1);
    });

    it('sollte über eine Split-Zeile dieselbe Buchung öffnen', () => {
      const onOpenDetails = vi.fn();
      renderList({ onOpenDetails });

      fireEvent.click(screen.getByRole('button', { name: 'Aufteilung anzeigen' }));
      fireEvent.click(screen.getByRole('button', { name: /Kleidung/ }));

      expect(onOpenDetails).toHaveBeenCalledWith(ALDI);
    });
  });

  describe('Kategorie-Filter', () => {
    it('sollte bei passendem Filter nur den passenden Anteil direkt anzeigen („Aldi └ Kleidung")', () => {
      renderList({ matched: new Set(['a-clothes']) });

      // Ohne Klick sichtbar — und nur der Kleidungs-Anteil.
      expect(screen.getByText('Kleidung')).toBeTruthy();
      expect(screen.queryByText('Lebensmittel')).toBeNull();
      expect(screen.getByText('-13,00 €')).toBeTruthy();
    });

    it('sollte beim manuellen Aufklappen trotz Filter die vollständige Aufteilung zeigen', () => {
      renderList({ matched: new Set(['a-clothes']) });

      fireEvent.click(screen.getByRole('button', { name: 'Aufteilung ausblenden' }));
      expect(screen.queryByText('Kleidung')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Aufteilung anzeigen' }));
      expect(screen.getByText('Lebensmittel')).toBeTruthy();
      expect(screen.getByText('Kleidung')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('sollte einen Anteil ohne (bekannte) Kategorie beschriften', () => {
      const orphan = new Map<string, TransactionAllocation[]>([
        ['aldi', [{ id: 'a-x', transaction_id: 'aldi', amount_minor: -5000, category_id: null, source: 'manual' } as TransactionAllocation]],
      ]);
      renderWithI18n(
        <TransactionDayList
          transactions={[ALDI]}
          categories={CATEGORIES}
          accounts={[]}
          hiddenTransactions={new Set()}
          onOpenDetails={vi.fn()}
          endingBalance={1000}
          allocationsByTransaction={orphan}
          matchedAllocationIds={new Set(['a-x'])}
          now={NOW}
        />,
      );

      expect(screen.getByText('Ohne Kategorie')).toBeTruthy();
    });

    it('sollte ohne Aufteilungs-Map wie bisher rendern', () => {
      renderWithI18n(
        <TransactionDayList
          transactions={[ALDI]}
          categories={CATEGORIES}
          accounts={[]}
          hiddenTransactions={new Set()}
          onOpenDetails={vi.fn()}
          endingBalance={1000}
          now={NOW}
        />,
      );

      expect(screen.queryByLabelText('aufgeteilt')).toBeNull();
      expect(screen.getByText('Aldi')).toBeTruthy();
    });

    it('sollte auch in der virtualisierten Liste Split-Zeilen einreihen', () => {
      // Über dem Virtualisierungs-Schwellwert (150 Items) rendert die Liste
      // fenstergestützt — die Split-Zeilen müssen dort ebenso erscheinen.
      const many: Transaction[] = Array.from({ length: 200 }, (_, i) => ({
        ...ALDI,
        id: asTransactionId(`tx-${i}`),
        payee: `Buchung ${i}`,
        date: '2026-07-03',
      }));
      const withSplit = new Map<string, TransactionAllocation[]>([
        ['tx-0', [{ id: 's-0', transaction_id: 'tx-0', amount_minor: -5000, category_id: 'clothes', source: 'manual' } as TransactionAllocation]],
      ]);

      renderWithI18n(
        <TransactionDayList
          transactions={many}
          categories={CATEGORIES}
          accounts={[]}
          hiddenTransactions={new Set()}
          onOpenDetails={vi.fn()}
          endingBalance={1000}
          allocationsByTransaction={withSplit}
          matchedAllocationIds={new Set(['s-0'])}
          now={NOW}
        />,
      );

      expect(screen.getByRole('button', { name: /Kleidung/ })).toBeTruthy();
    });
  });

  describe('English locale', () => {
    it('should label the split toggle in English', () => {
      renderList({ locale: 'en' });

      expect(screen.getByLabelText('split')).toBeTruthy();
      const toggle = screen.getByRole('button', { name: 'Show split' });
      fireEvent.click(toggle);
      expect(screen.getByRole('button', { name: 'Hide split' })).toBeTruthy();
      expect(within(screen.getByRole('button', { name: /Kleidung/ })).getByText('Kleidung')).toBeTruthy();
    });
  });
});
