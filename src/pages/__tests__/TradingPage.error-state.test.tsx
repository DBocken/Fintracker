/**
 * Fehlerzustand der Trading-Fläche (WP-12.1, verschärft WP 7.1).
 *
 * Ein Depot, das nach einem Lesefehler leer aussieht, liest sich wie ein
 * Totalverlust. Von allen Leerzuständen der App ist das der erschreckendste.
 *
 * **Warum die Anwesenheit des Fehlers nicht reicht (WP 7.1, TEST-4).** Der
 * Test fragte bis hierher nur nach einem `role="alert"`. Grün wäre er damit
 * auch dann, wenn „Keine Positionen vorhanden" gleichzeitig darunter stünde —
 * genau die Gleichzeitigkeit, die `AccountManager` real hatte (WP 6.5a). Bei
 * einem Depot ist diese Verwechslung nicht bloß falsch, sie erschreckt.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

// Der Verschluesselungs-Kontext ist fuer diese Frage ohne Belang, seine
// Abwesenheit wuerde die Flaeche aber vor dem ersten Render abbrechen lassen.
vi.mock('@/hooks/useLocalEncryption', () => ({
  useLocalEncryption: () => ({ enabled: false, unlocked: true }),
}));

vi.mock('@/services/portfolio-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getActivePortfolio: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import TradingPage from '../TradingPage';

describe('Fehlerzustand der Trading-Fläche', () => {
  it('[ZUSTAND /trading:fehler] sollte (de) den Ladefehler benennen statt ein leeres Depot', async () => {
    renderWithProviders(<TradingPage />, { query: true, router: true, locale: 'de' });

    await screen.findByText('Deine Daten konnten nicht geladen werden', {}, { timeout: 4000 });

    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    // „Keine Positionen vorhanden" nach einem Lesefehler liest sich als
    // Totalverlust — die Positionsliste darf hier gar nicht erst erscheinen.
    expect(screen.queryByText('Keine Positionen vorhanden')).toBeNull();
  });

  it('[ZUSTAND /trading:fehler] sollte (en) den Ladefehler benennen statt ein leeres Depot', async () => {
    renderWithProviders(<TradingPage />, { query: true, router: true, locale: 'en' });

    await screen.findByText('Your data could not be loaded', {}, { timeout: 4000 });

    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(screen.queryByText('No positions available')).toBeNull();
  });
});
