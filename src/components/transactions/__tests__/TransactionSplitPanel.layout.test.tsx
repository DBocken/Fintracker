import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { expectNoLayoutOverlap } from '@/test-utils/layout-overlap';
import { TransactionSplitPanel } from '../TransactionSplitPanel';
import type { Transaction, Category } from '@/types';

/**
 * Layout-Regression für den Screenshot-Bug „Buchung aufteilen": Die an
 * CategoryTwoStepSelect übergebene feste Höhe kollabierte die mehrzeilige
 * Kategorie-Auswahl, deren Inhalt Notiz-Feld und Folgezeile überlappte.
 * Die allgemeine Invariante über alle Seiten prüft der Sweep in
 * `src/__tests__/layout-overlap.sweep.test.tsx`; hier steht der konkrete
 * Regressionsfall des Panels.
 */

const mocks = vi.hoisted(() => ({
  getAllocationsForTransaction: vi.fn(),
  setAllocations: vi.fn(),
  clearAllocations: vi.fn(),
  validateAllocations: vi.fn(),
}));

vi.mock('@/services/transaction-allocation-service', () => ({
  getAllocationsForTransaction: mocks.getAllocationsForTransaction,
  setAllocations: mocks.setAllocations,
  clearAllocations: mocks.clearAllocations,
  validateAllocations: mocks.validateAllocations,
}));

const tx = { id: 't1', amount: -61.27, date: '2026-01-01' } as Transaction;

const categories: Category[] = [
  { id: 'main-1', name: 'Haushalt', parent_id: null },
  { id: 'sub-1', name: 'Strom', parent_id: 'main-1' },
] as Category[];

function renderPanel(locale: 'de' | 'en' = 'de') {
  return renderWithProviders(<TransactionSplitPanel transaction={tx} categories={categories} />, {
    locale,
    query: true,
  });
}

describe('TransactionSplitPanel – Layout-Überlappung', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllocationsForTransaction.mockResolvedValue([]);
    mocks.validateAllocations.mockReturnValue({ valid: true, deltaMinor: 0 });
  });

  it('[REGRESSION] sollte im Split-Panel keine überlappenden Elemente erzeugen (Mobile + Desktop)', () => {
    renderPanel();
    // document.body statt container: deckt auch Portal-Inhalte (Selects) ab.
    expectNoLayoutOverlap(document.body);
  });

  it('sollte pro Split-Zeile Betrag, Kategorie-Auswahl und Notiz-Feld in einer eigenen Karte rendern', () => {
    renderPanel();
    expect(screen.getAllByPlaceholderText('Notiz (optional)').length).toBe(2);
    expect(screen.getAllByText('1. Hauptkategorie').length).toBe(2);
    for (const trigger of screen.getAllByRole('combobox')) {
      expect(trigger).toHaveClass('h-8');
    }
  });

  describe('English locale', () => {
    it('should render the split rows without overlap (en)', () => {
      renderPanel('en');
      expect(screen.getAllByPlaceholderText('Note (optional)').length).toBe(2);
      expect(screen.getAllByText('1. Main category').length).toBe(2);
      expectNoLayoutOverlap(document.body);
    });
  });
});
