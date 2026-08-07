/**
 * Zustände der Trading-Fläche (WP-12.1).
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

// Der Verschluesselungs-Kontext ist fuer diese Frage ohne Belang, seine
// Abwesenheit wuerde die Flaeche aber vor dem ersten Render abbrechen lassen.
vi.mock('@/components/providers/LocalEncryptionProvider', () => ({
  useLocalEncryption: () => ({ enabled: false, unlocked: true }),
}));

import TradingPage from '../TradingPage';

describe('Leerzustand der Trading-Fläche', () => {
  it('[ZUSTAND /trading:leer] sollte ohne Depot keinen Ladefehler behaupten', async () => {
    renderWithProviders(<TradingPage />, { query: true, router: true });

    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(screen.queryByText('Deine Daten konnten nicht geladen werden')).toBeNull();
  });
});
