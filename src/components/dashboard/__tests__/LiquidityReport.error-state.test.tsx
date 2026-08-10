/**
 * Fehlerzustand der Liquiditäts-Fläche (WP-12.1).
 *
 * Die Prognose sagt, wie lange das Geld reicht. Eine aus leeren Daten
 * gerechnete Prognose sagt das auch — nur falsch, und ohne es zu verraten.
 *
 * Zur Verortung siehe `LiquidityReport.states.test.tsx`: Die Seite selbst
 * laesst sich in jsdom nicht rendern (Web Worker), die Zustands-Weiche liegt
 * hier.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/hooks/useScenarioRisk', () => ({
  useScenarioRisk: () => ({ result: null, isCalculating: false }),
}));

vi.mock('@/services/forecast-data', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  buildForecastInput: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import LiquidityReport from '../LiquidityReport';

describe('Fehlerzustand der Liquiditäts-Fläche', () => {
  it('[REGRESSION] [ZUSTAND /liquidity:fehler] sollte den Ladefehler benennen, ohne die technische Meldung zu zeigen', async () => {
    renderWithProviders(<LiquidityReport />, { query: true, router: true });

    await screen.findByText('Deine Daten konnten nicht geladen werden', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
    // Der Nutzer bekommt NICHT die Ausnahme des Speichers zu lesen.
    expect(screen.queryByText(/IndexedDB/i)).toBeNull();
    // WP 7.1: Der Fehler steht an der STELLE der Prognose, nicht darüber —
    // sonst rechnet die Fläche daneben weiter aus leeren Daten und sagt, wie
    // lange das Geld reicht (Gegenstück in
    // `LiquidityReport.overrides-error-state.test.tsx`).
    expect(screen.queryByText('Frag dein Geld')).toBeNull();
  });

  it('[ZUSTAND /liquidity:fehler] sollte (en) den Ladefehler benennen, ohne die technische Meldung zu zeigen', async () => {
    renderWithProviders(<LiquidityReport />, { query: true, router: true, locale: 'en' });

    await screen.findByText('Your data could not be loaded', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText(/IndexedDB/i)).toBeNull();
    expect(screen.queryByText('Ask your money')).toBeNull();
  });
});
