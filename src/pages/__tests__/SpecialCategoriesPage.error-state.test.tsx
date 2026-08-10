/**
 * Fehlerzustand der Anlässe-Fläche `/occasions` (WP-12.1, verschärft WP 7.1).
 *
 * Anlässe (Urlaub, Umzug, Geburt) bündeln Ausgaben über Kategoriegrenzen
 * hinweg. Fehlen sie nach einem Lesefehler, sieht es aus, als hätte der Nutzer
 * nie einen angelegt.
 *
 * **Warum die Anwesenheit des Fehlers nicht reicht (WP 7.1, TEST-4).** Der
 * Test fragte bis hierher nur nach einem `role="alert"`. Grün wäre er damit
 * auch dann, wenn „Noch keine Anlässe" gleichzeitig danebenstünde — genau die
 * Gleichzeitigkeit, die `AccountManager` real hatte (WP 6.5a).
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
  it('[ZUSTAND /occasions:fehler] sollte (de) den Ladefehler benennen statt „noch keine Anlässe"', async () => {
    renderWithProviders(<SpecialCategoriesPage />, { query: true, router: true, locale: 'de' });

    await screen.findByText('Deine Daten konnten nicht geladen werden', {}, { timeout: 4000 });

    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    // Weder in der Desktop- noch in der Mobilvariante darf der Leerzustand
    // daneben stehen — beide Präsentationen lesen dasselbe ViewModel.
    expect(screen.queryAllByText('Noch keine Anlässe')).toHaveLength(0);
  });

  it('[ZUSTAND /occasions:fehler] sollte (en) den Ladefehler benennen statt „noch keine Anlässe"', async () => {
    renderWithProviders(<SpecialCategoriesPage />, { query: true, router: true, locale: 'en' });

    await screen.findByText('Your data could not be loaded', {}, { timeout: 4000 });

    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('No occasions yet')).toHaveLength(0);
  });
});
