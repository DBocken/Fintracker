/**
 * Fehlerzustand der Meilenstein-Fläche (WP-12.1).
 *
 * Ohne Fehlerzustand zeigte die Seite nach einem Lesefehler „0 / 0 erreicht" —
 * eine Zahl, die wie ein Ergebnis aussieht und keines ist.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/services/milestones-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  evaluateMilestones: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import MilestonesPage from '../MilestonesPage';

describe('Fehlerzustand der Meilenstein-Fläche', () => {
  it('[ZUSTAND /milestones:fehler] sollte den Ladefehler benennen statt „0 erreicht"', async () => {
    renderWithProviders(<MilestonesPage />, { query: true, router: true });

    await screen.findByText('Deine Daten konnten nicht geladen werden', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
  });
});
