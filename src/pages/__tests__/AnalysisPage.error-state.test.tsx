/**
 * Fehlerzustand der Auswertungs-Fläche `/premium` (WP-12.1).
 *
 * Auswertungen aus leeren Daten sehen wie Auswertungen aus: Achsen, Legenden,
 * Prozentzahlen — nur eben alle null. Das ist die stillste Art, falsch zu
 * informieren.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/services/transaction-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getTransactions: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import AnalysisPage from '../AnalysisPage';

describe('Fehlerzustand der Auswertungs-Fläche', () => {
  it('[ZUSTAND /premium:fehler] sollte den Ladefehler benennen statt Auswertungen aus Nullen', async () => {
    renderWithProviders(<AnalysisPage />, { query: true, router: true });

    await screen.findByRole('alert', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
