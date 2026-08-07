/**
 * Zustände der Anlässe-Fläche `/occasions` (WP-12.1).
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({ status: 'authenticated' }),
}));

import SpecialCategoriesPage from '../SpecialCategoriesPage';

describe('Leerzustand der Anlässe-Fläche', () => {
  it('[ZUSTAND /occasions:leer] sollte ohne Anlässe keinen Ladefehler behaupten', async () => {
    renderWithProviders(<SpecialCategoriesPage />, { query: true, router: true });

    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(screen.queryByText('Deine Daten konnten nicht geladen werden')).toBeNull();
  });
});
