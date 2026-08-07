/**
 * Zustände der Liquiditäts-Fläche (WP-12.1).
 *
 * **Warum hier und nicht auf `LiquidityPage`.** Die Seite zieht über
 * `useScenarioRisk`/`useAffordability` Web Worker hoch; die gibt es in jsdom
 * nicht, und ohne sie rendert die Seite gar nichts. Die Zustands-Weiche liegt
 * ohnehin in `LiquidityReport` — der Tag benennt die FLÄCHE, nicht die Datei.
 *
 * [REGRESSION] Der Fehlerzustand zeigte vorher `error.message`, also
 * „IndexedDB nicht erreichbar" auf dem Bildschirm eines Menschen, der die App
 * benutzt statt sie zu bauen — und bot keinen Wiederholversuch an.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/hooks/useScenarioRisk', () => ({
  useScenarioRisk: () => ({ result: null, isCalculating: false }),
}));

import LiquidityReport from '../LiquidityReport';

describe('Zustände der Liquiditäts-Fläche', () => {
  it('[ZUSTAND /liquidity:leer] sollte ohne Buchungen keinen Fehler behaupten', async () => {
    renderWithProviders(<LiquidityReport />, { query: true, router: true });

    // Gepruef wird die Abwesenheit des FEHLERTEXTES, nicht die jedes
    // `role="alert"`: Diese Flaeche fuehrt auch fachliche Hinweise als Alarm
    // (etwa die Puffer-Unterschreitung), und die sind hier voellig richtig.
    // Falsch waere allein die Behauptung, die Daten seien nicht ladbar.
    await screen.findByText('Frag dein Geld', {}, { timeout: 4000 });

    expect(screen.queryByText('Deine Daten konnten nicht geladen werden')).toBeNull();
  });
});
