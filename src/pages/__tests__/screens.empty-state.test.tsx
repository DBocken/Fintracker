/**
 * Leerzustände der Kern-Flächen (WP-12.1).
 *
 * Gegenstück zu `screens.error-state.test.tsx`. Die Gegenprobe auf
 * `role="alert"` ist der eigentliche Test: Sie hält fest, dass hier der
 * LEERZUSTAND steht und nicht versehentlich eine Fehlermeldung — dieselbe
 * Verwechslung, nur aus der anderen Richtung.
 *
 * Ohne Mocks: Der Testspeicher startet leer, und genau das ist der Zustand
 * eines neuen Nutzers.
 *
 * Zur Bauart: erst warten, dann FRISCH abfragen — ein gehaltener Knoten kann
 * bis zur Zusicherung durch einen Folge-Render ersetzt worden sein (siehe
 * CoachPage.error-state.test.tsx).
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

import DebtsPage from '../DebtsPage';
import NetWorthPage from '../NetWorthPage';
import AccountsPage from '../AccountsPage';
import TaxReportPage from '../TaxReportPage';

describe('Leerzustände der Kern-Flächen', () => {
  it('[ZUSTAND /debts:leer] sollte ohne Schulden das sagen — und keinen Fehler behaupten', async () => {
    renderWithProviders(<DebtsPage />, { query: true, router: true });

    await screen.findByText(/Noch keine Schulden/i, {}, { timeout: 4000 });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('[ZUSTAND /net-worth:leer] sollte ohne Vermögenswerte zum Anfangen einladen', async () => {
    renderWithProviders(<NetWorthPage />, { query: true, router: true });

    await screen.findByText('Noch keine Transaktionen', {}, { timeout: 4000 });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('[ZUSTAND /accounts:leer] sollte ohne Konten das sagen', async () => {
    renderWithProviders(<AccountsPage />, { query: true, router: true });

    // Die Bargeld-Karte ist der immer sichtbare Teil dieser Flaeche; ohne
    // Konten steht dort ihr Leertext mit der naechsten Handlung.
    await screen.findByText(
      'Lege ein Bargeld-Konto an, um Abhebungen und Barausgaben zu tracken.',
      {},
      { timeout: 4000 },
    );

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('[ZUSTAND /tax:leer] sollte ohne markierte Buchungen das sagen', async () => {
    renderWithProviders(<TaxReportPage />, { query: true, router: true });

    await screen.findByText('Noch nichts markiert', {}, { timeout: 4000 });

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
