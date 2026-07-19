import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { TransactionSplitPanel } from '../TransactionSplitPanel';
import type { Transaction, Category } from '@/types';

/**
 * Layout-Überlappungstests für „Buchung aufteilen" (Screenshot-Bug):
 * Das Panel übergab `className="h-8 text-sm"` an CategoryTwoStepSelect, wo
 * die feste Höhe auf dem mehrzeiligen Wrapper landete — Kategorie-Selects und
 * Badges liefen über das Notiz-Feld und die nächste Split-Zeile. jsdom hat
 * keine Layout-Engine, daher prüfen die Tests die Klassen-Invarianten.
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

const FIXED_HEIGHT_RE = /^h-\d+(\.\d+)?$/;
const FIXED_WIDTH_RE = /^w-\d+(\.\d+)?$/;

function hasFixedHeightClass(el: Element): boolean {
  return Array.from(el.classList).some((c) => FIXED_HEIGHT_RE.test(c));
}

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

  describe('Negativtests: überlappungsverursachende Muster ausgeschlossen', () => {
    it('[REGRESSION] sollte die mehrzeilige Kategorie-Auswahl nicht auf eine feste Höhe kollabieren lassen (Überlappung mit Notiz-Feld und Folgezeile)', () => {
      renderPanel();
      const badges = screen.getAllByText('1. Hauptkategorie');
      expect(badges.length).toBe(2);
      for (const badge of badges) {
        // Kein Vorfahre zwischen Badge und Zeilen-Karte (rounded-lg) darf
        // eine feste Höhenklasse tragen — sonst überlappt der Inhalt die
        // nachfolgenden Elemente.
        let el: HTMLElement | null = badge.parentElement;
        while (el && !el.classList.contains('rounded-lg')) {
          expect(hasFixedHeightClass(el)).toBe(false);
          el = el.parentElement;
        }
        expect(el).not.toBeNull();
      }
    });

    it('[MOBILE] sollte keine Select-Trigger mit fester Breite ohne Breakpoint-Präfix enthalten (kein horizontales Überlaufen auf schmalen Viewports)', () => {
      renderPanel();
      const triggers = screen.getAllByRole('combobox');
      expect(triggers.length).toBeGreaterThan(0);
      for (const trigger of triggers) {
        expect(Array.from(trigger.classList).some((c) => FIXED_WIDTH_RE.test(c))).toBe(false);
      }
    });
  });

  describe('Positivtests: erwartetes Layout vorhanden', () => {
    it('sollte pro Split-Zeile Betrag, Kategorie-Auswahl und Notiz-Feld gestapelt in einer eigenen Karte rendern', () => {
      renderPanel();
      const noteInputs = screen.getAllByPlaceholderText('Notiz (optional)');
      expect(noteInputs.length).toBe(2);
      for (const note of noteInputs) {
        const card = note.closest('div.rounded-lg') as HTMLElement;
        expect(card).not.toBeNull();
        expect(card).toHaveClass('flex-col');
      }
    });

    it('sollte die kompakte Größenklasse an die Select-Trigger statt an den Wrapper anlegen', () => {
      renderPanel();
      const triggers = screen.getAllByRole('combobox');
      for (const trigger of triggers) {
        expect(trigger).toHaveClass('h-8');
      }
    });

    it('[MOBILE] sollte Select-Trigger auf mobiler Breite volle Breite nutzen und auf Desktop begrenzen', () => {
      renderPanel();
      const triggers = screen.getAllByRole('combobox');
      for (const trigger of triggers) {
        expect(trigger).toHaveClass('w-full', 'min-w-0');
        expect(
          Array.from(trigger.classList).some((c) => c === 'sm:w-44' || c === 'sm:w-48'),
        ).toBe(true);
      }
    });
  });

  describe('English locale', () => {
    it('should keep the multi-line category select uncollapsed (en)', () => {
      renderPanel('en');
      const badges = screen.getAllByText('1. Main category');
      expect(badges.length).toBe(2);
      for (const badge of badges) {
        let el: HTMLElement | null = badge.parentElement;
        while (el && !el.classList.contains('rounded-lg')) {
          expect(hasFixedHeightClass(el)).toBe(false);
          el = el.parentElement;
        }
        expect(el).not.toBeNull();
      }
      expect(screen.getAllByPlaceholderText('Note (optional)').length).toBe(2);
    });
  });
});
