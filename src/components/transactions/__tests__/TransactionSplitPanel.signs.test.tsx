import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { TransactionSplitPanel } from '../TransactionSplitPanel';
import type { Transaction, Category, TransactionAllocation } from '@/types';

/**
 * Vorzeichen-Verhalten der Aufteilung: Der Nutzer gibt nur BETRÄGE ein, das
 * Vorzeichen kommt aus der Buchung (`@/lib/split-amounts`). Der offene Rest
 * wird vom Gesamtbetrag abgezogen — inklusive der korrekten Beschriftung
 * „offen" vs. „zu viel" bei Ausgaben.
 */

const mocks = vi.hoisted(() => ({
  getAllocationsForTransaction: vi.fn(),
  setAllocations: vi.fn(),
  clearAllocations: vi.fn(),
}));

vi.mock('@/services/transaction-allocation-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/transaction-allocation-service')>();
  return {
    ...actual,
    getAllocationsForTransaction: mocks.getAllocationsForTransaction,
    setAllocations: mocks.setAllocations,
    clearAllocations: mocks.clearAllocations,
  };
});

const categories: Category[] = [
  { id: 'food', name: 'Lebensmittel', parent_id: null },
  { id: 'clothes', name: 'Kleidung', parent_id: null },
] as Category[];

const expense = { id: 't1', amount: -50, date: '2026-01-01' } as Transaction;
const income = { id: 't2', amount: 50, date: '2026-01-01' } as Transaction;

function renderPanel(transaction: Transaction, locale: 'de' | 'en' = 'de') {
  return renderWithProviders(<TransactionSplitPanel transaction={transaction} categories={categories} />, {
    locale,
    query: true,
  });
}

function amountInputs(): HTMLInputElement[] {
  return screen.getAllByPlaceholderText('0,00') as HTMLInputElement[];
}

describe('TransactionSplitPanel – Vorzeichen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllocationsForTransaction.mockResolvedValue([]);
    mocks.setAllocations.mockResolvedValue([]);
  });

  describe('Normal Behavior', () => {
    it('sollte eine Ausgabe aus vorzeichenlosen Eingaben negativ aufteilen', async () => {
      renderPanel(expense);

      const [first, second] = amountInputs();
      fireEvent.change(first, { target: { value: '30' } });
      fireEvent.change(second, { target: { value: '20' } });

      fireEvent.click(screen.getByRole('button', { name: 'Aufteilung speichern' }));

      await waitFor(() => expect(mocks.setAllocations).toHaveBeenCalled());
      const inputs = mocks.setAllocations.mock.calls[0][1] as { amount_minor: number }[];
      expect(inputs.map((i) => i.amount_minor)).toEqual([-3000, -2000]);
    });

    it('sollte eine Einnahme aus denselben Eingaben positiv aufteilen', async () => {
      renderPanel(income);

      const [first, second] = amountInputs();
      fireEvent.change(first, { target: { value: '30' } });
      fireEvent.change(second, { target: { value: '20' } });

      fireEvent.click(screen.getByRole('button', { name: 'Aufteilung speichern' }));

      await waitFor(() => expect(mocks.setAllocations).toHaveBeenCalled());
      const inputs = mocks.setAllocations.mock.calls[0][1] as { amount_minor: number }[];
      expect(inputs.map((i) => i.amount_minor)).toEqual([3000, 2000]);
    });

    it('sollte den offenen Rest vom Gesamtbetrag abziehen und als „offen" beschriften', () => {
      renderPanel(expense);

      fireEvent.change(amountInputs()[0], { target: { value: '30' } });

      // 50 € Ausgabe − 30 € zugewiesen = 20 € offen.
      expect(screen.getByText(/noch 20,00 € offen/)).toBeTruthy();
    });

    it('sollte Überzuweisung als „zu viel" beschriften', () => {
      renderPanel(expense);

      fireEvent.change(amountInputs()[0], { target: { value: '60' } });

      expect(screen.getByText(/noch 10,00 € zu viel/)).toBeTruthy();
    });

    it('sollte „Rest hier eintragen" die Zeile auf ihren Betrag plus Rest setzen', () => {
      renderPanel(expense);

      const [first, second] = amountInputs();
      fireEvent.change(first, { target: { value: '30' } });
      // Rest (20 €) in die zweite, noch leere Zeile übernehmen.
      fireEvent.click(screen.getAllByTitle('Rest hier eintragen')[1]);
      expect(second.value).toBe('20,00');

      // Erste Zeile leeren: die zweite behält 20 €, offen sind wieder 30 €.
      fireEvent.change(first, { target: { value: '' } });
      // Klick auf die gefüllte Zeile ergänzt deren eigenen Betrag um den Rest.
      fireEvent.click(screen.getAllByTitle('Rest hier eintragen')[1]);
      expect(second.value).toBe('50,00');
    });

    it('sollte beim Zurücknehmen einer Überzuweisung nicht ins Negative kippen', () => {
      renderPanel(expense);

      const [first, second] = amountInputs();
      fireEvent.change(first, { target: { value: '70' } });
      fireEvent.change(second, { target: { value: '10' } });
      // 30 € zu viel: die 10-€-Zeile kann davon höchstens ihre eigenen 10 € abgeben.
      fireEvent.click(screen.getAllByTitle('Rest hier eintragen')[1]);

      expect(second.value).toBe('0,00');
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte ein vom Nutzer getipptes Minus ignorieren statt die Vorzeichen-Invariante zu verletzen', async () => {
      renderPanel(expense);

      const [first, second] = amountInputs();
      fireEvent.change(first, { target: { value: '-30' } });
      fireEvent.change(second, { target: { value: '20' } });

      expect(screen.queryByText(/noch .* zu viel/)).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Aufteilung speichern' }));

      await waitFor(() => expect(mocks.setAllocations).toHaveBeenCalled());
      const inputs = mocks.setAllocations.mock.calls[0][1] as { amount_minor: number }[];
      expect(inputs.map((i) => i.amount_minor)).toEqual([-3000, -2000]);
    });

    it('[REGRESSION] sollte gespeicherte Aufteilungen ohne Minuszeichen ins Eingabefeld laden', async () => {
      mocks.getAllocationsForTransaction.mockResolvedValue([
        { id: 'a1', transaction_id: 't1', amount_minor: -3000, category_id: 'food', label: null, source: 'manual' },
        { id: 'a2', transaction_id: 't1', amount_minor: -2000, category_id: 'clothes', label: null, source: 'manual' },
      ] as TransactionAllocation[]);

      renderPanel(expense);

      await waitFor(() => expect(amountInputs()[0].value).toBe('30,00'));
      expect(amountInputs()[1].value).toBe('20,00');
      // Vollständig aufgeteilt: kein Rest-Hinweis.
      expect(screen.queryByText(/noch .* offen/)).toBeNull();
    });
  });

  describe('English locale', () => {
    it('should label the unassigned remainder as unassigned for an expense', () => {
      renderPanel(expense, 'en');

      fireEvent.change(amountInputs()[0], { target: { value: '30' } });

      expect(screen.getByText(/still 20,00 € unassigned/)).toBeTruthy();
    });
  });
});
