/**
 * WP 1.7 — Fehlerzustand der Liquiditäts-Fläche bei kaputten Forecast-
 * Overrides.
 *
 * Vorher schluckte `getForecastOverrides()` JEDEN Fehler (auch einen
 * `VaultCorruptError`, WP 1.1) und lieferte still Defaults — die Seite
 * rendert dann normal weiter, als wären keine Annahmen hinterlegt, obwohl
 * welche da sind und nur nicht gelesen werden konnten. Dieser Test isoliert
 * genau diesen Pfad: `buildForecastInput` (Forecast-Daten) liefert normal,
 * NUR `getForecastOverrides` (Nutzer-Annahmen) schlägt fehl.
 *
 * Bilingual (de + en), starkes Muster wie `EuerPage.error-state.test.tsx`:
 * Fehlertext da UND die normale Ansicht („Frag dein Geld" / „Ask your
 * money"), die vorher trotz kaputter Overrides erschien, ist verschwunden.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/hooks/useScenarioRisk', () => ({
  useScenarioRisk: () => ({ result: null, isCalculating: false }),
}));

vi.mock('@/services/forecast-data', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  buildForecastInput: () => Promise.resolve({ accounts: [] }),
}));

vi.mock('@/services/forecast-overrides-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getForecastOverrides: () => Promise.reject(new Error('Envelope korrupt (Vault)')),
}));

import LiquidityReport from '../LiquidityReport';

describe('Fehlerzustand der Liquiditäts-Fläche bei kaputten Forecast-Overrides', () => {
  it('[REGRESSION] [ZUSTAND /liquidity:fehler] sollte (de) den Ladefehler benennen statt still auf Defaults auszuweichen', async () => {
    renderWithProviders(<LiquidityReport />, { query: true, router: true, locale: 'de' });

    await screen.findByText('Deine Daten konnten nicht geladen werden', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
    // Die normale Ansicht (inkl. „Frag dein Geld") darf NICHT erscheinen —
    // genau das war der Fehler: Overrides-Ausfall wurde bisher unsichtbar in
    // Defaults verwandelt und die Seite rendert normal weiter.
    expect(screen.queryByText('Frag dein Geld')).toBeNull();
    // Keine technische Fehlermeldung fuer jemanden, der die App benutzt statt
    // sie zu bauen.
    expect(screen.queryByText(/Envelope korrupt/i)).toBeNull();
  });

  it('[ZUSTAND /liquidity:fehler] sollte (en) den Ladefehler benennen statt still auf Defaults auszuweichen', async () => {
    renderWithProviders(<LiquidityReport />, { query: true, router: true, locale: 'en' });

    await screen.findByText('Your data could not be loaded', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('Ask your money')).toBeNull();
    expect(screen.queryByText(/Envelope korrupt/i)).toBeNull();
  });
});
