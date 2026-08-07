/**
 * Fehlerzustand der Import-Fläche (WP-12.1).
 *
 * Der Import ordnet Buchungen bestehenden Konten und Kategorien zu. Sind die
 * nicht lesbar, sieht die Zuordnung leer aus — und der Nutzer legt beim
 * Importieren Konten neu an, die es schon gibt.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/services/account-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAccounts: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import CsvPage from '../CsvPage';

describe('Fehlerzustand der Import-Fläche', () => {
  it('[ZUSTAND /csv:fehler] sollte den Ladefehler benennen statt eine leere Zuordnung anzubieten', async () => {
    renderWithProviders(<CsvPage />, { query: true, router: true });

    await screen.findByRole('alert', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
