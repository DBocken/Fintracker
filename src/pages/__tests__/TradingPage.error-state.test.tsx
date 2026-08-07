/**
 * Fehlerzustand der Trading-Fläche (WP-12.1).
 *
 * Ein Depot, das nach einem Lesefehler leer aussieht, liest sich wie ein
 * Totalverlust. Von allen Leerzuständen der App ist das der erschreckendste.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

// Der Verschluesselungs-Kontext ist fuer diese Frage ohne Belang, seine
// Abwesenheit wuerde die Flaeche aber vor dem ersten Render abbrechen lassen.
vi.mock('@/components/providers/LocalEncryptionProvider', () => ({
  useLocalEncryption: () => ({ enabled: false, unlocked: true }),
}));

vi.mock('@/services/portfolio-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getActivePortfolio: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import TradingPage from '../TradingPage';

describe('Fehlerzustand der Trading-Fläche', () => {
  it('[ZUSTAND /trading:fehler] sollte den Ladefehler benennen statt ein leeres Depot', async () => {
    renderWithProviders(<TradingPage />, { query: true, router: true });

    await screen.findByRole('alert', {}, { timeout: 4000 });

    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });
});
