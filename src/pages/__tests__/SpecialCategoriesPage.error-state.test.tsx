/**
 * Fehlerzustand der Anlässe-Fläche `/occasions` (WP-12.1).
 *
 * Anlässe (Urlaub, Umzug, Geburt) bündeln Ausgaben über Kategoriegrenzen
 * hinweg. Fehlen sie nach einem Lesefehler, sieht es aus, als hätte der Nutzer
 * nie einen angelegt.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({ status: 'authenticated' }),
}));

vi.mock('@/services/special-category-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSpecialCategories: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import SpecialCategoriesPage from '../SpecialCategoriesPage';

describe('Fehlerzustand der Anlässe-Fläche', () => {
  it('[ZUSTAND /occasions:fehler] sollte den Ladefehler benennen statt „noch keine Anlässe"', async () => {
    renderWithProviders(<SpecialCategoriesPage />, { query: true, router: true });

    await screen.findByRole('alert', {}, { timeout: 4000 });

    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });
});
