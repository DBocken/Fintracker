/**
 * Leerzustand der Vertrags-Fläche (WP-12.1).
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

import ContractsPage from '../ContractsPage';

describe('Leerzustand der Vertrags-Fläche', () => {
  it('[ZUSTAND /contracts:leer] sollte ohne Verträge das sagen — und keinen Fehler behaupten', async () => {
    renderWithProviders(<ContractsPage />, { query: true, router: true });

    // `findAllBy…`: Desktop- und Mobilvariante stehen in jsdom gleichzeitig im
    // Baum (im Browser blendet Tailwind eine davon aus). Fuer die Frage nach
    // dem ZUSTAND ist das ohne Belang.
    await screen.findAllByText(/Noch keine Verträge aktiv/i, {}, { timeout: 4000 });

    expect(screen.queryByText('Deine Daten konnten nicht geladen werden')).toBeNull();
  });
});
