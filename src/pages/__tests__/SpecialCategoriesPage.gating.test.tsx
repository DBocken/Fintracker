import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { Tier } from '@/lib/tier';
import { renderWithProviders } from '@/test-utils/render';
import RouteGuard from '@/components/layout/RouteGuard';
import SpecialCategoriesPage from '../SpecialCategoriesPage';

const gatedPage = (
  <RouteGuard path="/occasions">
    <SpecialCategoriesPage />
  </RouteGuard>
);

const { tierRef } = vi.hoisted(() => ({ tierRef: { current: 'free' as Tier } }));

vi.mock('@/hooks/useTier', () => ({ useTier: () => tierRef.current }));
vi.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({ status: 'authenticated' }),
}));
vi.mock('@/services/special-category-service', () => ({
  getSpecialCategories: async () => [],
  getSpecialCategoryAssignments: async () => [],
  saveSpecialCategory: vi.fn(),
  deleteSpecialCategory: vi.fn(),
  assignTransaction: vi.fn(),
  unassign: vi.fn(),
}));
vi.mock('@/services/transaction-service', () => ({ getAllTransactions: async () => [] }));

beforeEach(() => {
  tierRef.current = 'free';
});

describe('SpecialCategoriesPage Premium-Gating (S11)', () => {
  it('sollte im Free-Tier keinen Zugriff auf die Anlass-Verwaltung geben', () => {
    tierRef.current = 'free';
    renderWithProviders(gatedPage, { query: true, locale: 'de' });
    // Locked-Preview statt Inhalt: kein „Neuer Anlass" möglich.
    expect(screen.queryByRole('button', { name: 'Neuer Anlass' })).not.toBeInTheDocument();
  });

  it('sollte im Premium-Tier die Anlass-Verwaltung freischalten', async () => {
    tierRef.current = 'premium';
    renderWithProviders(gatedPage, { query: true, locale: 'de' });
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Neuer Anlass' }).length).toBeGreaterThan(0),
    );
  });
});
