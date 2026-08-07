/**
 * Fehlerzustand der Export-Fläche (WP-12.1).
 *
 * Ein Export aus unlesbaren Daten ist die gefährlichste Datei der App: Sie
 * sieht aus wie ein Backup und ist leer.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/services/transaction-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getTransactions: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import ExportPage from '../ExportPage';

describe('Fehlerzustand der Export-Fläche', () => {
  it('[ZUSTAND /export:fehler] sollte den Ladefehler benennen statt einen leeren Export anzubieten', async () => {
    renderWithProviders(<ExportPage />, { query: true, router: true });

    await screen.findByRole('alert', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
