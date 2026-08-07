/**
 * Fehlerzustand der Finanzstadt (WP-12.1).
 *
 * Die Stadt ist eine Darstellung von Geld als Gebäude. Nach einem Lesefehler
 * eine leere Stadt zu zeigen heisst: „du besitzt nichts" — in Bildern, die
 * stärker wirken als jede Zahl.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/services/transaction-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getTransactions: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import CityPage from '../CityPage';

describe('Fehlerzustand der Finanzstadt', () => {
  it('[ZUSTAND /city:fehler] sollte den Ladefehler benennen statt eine leere Stadt zu zeigen', async () => {
    renderWithProviders(<CityPage />, { query: true, router: true });

    await screen.findByText('Deine Buchungen konnten nicht geladen werden', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
