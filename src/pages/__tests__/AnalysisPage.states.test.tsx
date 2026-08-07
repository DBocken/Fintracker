/**
 * Zustände der Auswertungs-Fläche `/premium` (WP-12.1).
 *
 * Der Leerzustand steht hier ohne Mock: Der Testspeicher startet leer.
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

import AnalysisPage from '../AnalysisPage';

describe('Leerzustand der Auswertungs-Fläche', () => {
  it('[ZUSTAND /premium:leer] sollte ohne Buchungen keinen Ladefehler behaupten', async () => {
    renderWithProviders(<AnalysisPage />, { query: true, router: true });

    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(screen.queryByText('Deine Buchungen konnten nicht geladen werden')).toBeNull();
    expect(screen.queryByText('Deine Daten konnten nicht geladen werden')).toBeNull();
  });
});
