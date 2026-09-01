/**
 * Fehlerzustand der Vertrags-Fläche (WP-12.1).
 *
 * „Noch keine Verträge aktiv" nach einem Lesefehler liest sich wie Entwarnung:
 * keine laufenden Kosten. Das ist die falsche Beruhigung.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/services/transaction-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAllTransactions: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import ContractsPage from '../ContractsPage';

describe('Fehlerzustand der Vertrags-Fläche', () => {
  it('[ZUSTAND /contracts:fehler] sollte den Ladefehler benennen statt „noch keine Verträge"', async () => {
    renderWithProviders(<ContractsPage />, { query: true, router: true });

    await screen.findByText('Deine Daten konnten nicht geladen werden', {}, { timeout: 4000 });

    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    // Kein „noch keine Vertraege" daneben — weder in der Desktop- noch in der
    // Mobilvariante.
    expect(screen.queryAllByText(/Noch keine Verträge aktiv/i)).toHaveLength(0);
  });
});
