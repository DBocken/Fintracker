/**
 * Fehlerzustand der Meilenstein-Fläche (WP-12.1, verschärft WP 7.1).
 *
 * Ohne Fehlerzustand zeigte die Seite nach einem Lesefehler „0 / 0 erreicht" —
 * eine Zahl, die wie ein Ergebnis aussieht und keines ist.
 *
 * **Was WP 7.1 ergänzt (TEST-4).** Fehlertext und Knopf waren geprüft, die
 * Abwesenheit des Null-Fortschritts nicht — und der ist hier die irreführende
 * Aussage: Ein Fortschrittsbalken auf 0 % behauptet, es sei nichts erreicht.
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
  it('[ZUSTAND /milestones:fehler] sollte (de) den Ladefehler benennen statt „0 erreicht"', async () => {
    renderWithProviders(<MilestonesPage />, { query: true, router: true, locale: 'de' });

    await screen.findByText('Deine Daten konnten nicht geladen werden', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
    // Das Fortschritts-Readout ist die irreführende Aussage: „Erreichte
    // Meilensteine 0 / 0" liest sich als Ergebnis, ist aber ein ungelesener
    // Wert. Auch der Balken (`progressbar`) darf dann nicht dastehen.
    expect(screen.queryByText('Erreichte Meilensteine')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('[ZUSTAND /milestones:fehler] sollte (en) den Ladefehler benennen statt „0 erreicht"', async () => {
    renderWithProviders(<MilestonesPage />, { query: true, router: true, locale: 'en' });

    await screen.findByText('Your data could not be loaded', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Achieved milestones')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
