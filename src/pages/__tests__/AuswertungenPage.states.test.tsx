/**
 * Die Auswertungen — Leer- und Fehlerzustand.
 *
 * Dieselbe Verwechslung wie auf Dashboard und Buchungsseite, an einer neuen
 * Fläche: Nach einem Lesefehler „du hast noch nichts" zu behaupten, fordert
 * zum Neuerfassen von Daten auf, die längst da sind. Die Fläche zeigt
 * ausschliesslich abgeleitete Zahlen — hier ist die Verwechslung besonders
 * billig zu machen und besonders teuer zu bemerken.
 *
 * Der Test geht durch das ECHTE ViewModel (nur die Datenquelle scheitert),
 * nicht durch eine Attrappe: Eine Attrappe bewiese nur, dass die Seite ein
 * Flag auswertet, das ihr jemand hineingereicht hat.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

const { fehlschlag } = vi.hoisted(() => ({ fehlschlag: { aktiv: true } }));

vi.mock('@/services/transaction-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAllTransactions: () =>
    fehlschlag.aktiv
      ? Promise.reject(new Error('IndexedDB nicht erreichbar'))
      : Promise.resolve([]),
}));

import AuswertungenPage from '../AuswertungenPage';

describe('Auswertungen — Zustände', () => {
  it('[ZUSTAND /auswertungen:fehler] sollte einen Ladefehler benennen statt „keine Daten" zu behaupten', async () => {
    fehlschlag.aktiv = true;
    renderWithProviders(<AuswertungenPage />, { router: true, query: true });

    expect(await screen.findByText('Deine Daten konnten nicht geladen werden')).toBeInTheDocument();
    // Beide könnten untereinander stehen — der Fehlertext allein beweist
    // nicht, dass der Leerzustand weg ist (WP 6.5a, `AccountManager`).
    expect(screen.queryByText('Noch keine Transaktionen')).toBeNull();
  });

  it('[ZUSTAND /auswertungen:fehler] sollte (en) einen Ladefehler benennen', async () => {
    fehlschlag.aktiv = true;
    renderWithProviders(<AuswertungenPage />, { router: true, query: true, locale: 'en' });

    expect(await screen.findByText('Your data could not be loaded')).toBeInTheDocument();
  });

  it('[ZUSTAND /auswertungen:leer] sollte ohne Buchungen den Leerzustand zeigen', async () => {
    fehlschlag.aktiv = false;
    renderWithProviders(<AuswertungenPage />, { router: true, query: true });

    expect(await screen.findByText('Noch keine Transaktionen')).toBeInTheDocument();
    expect(screen.queryByText('Deine Daten konnten nicht geladen werden')).toBeNull();
  });

  it('[ZUSTAND /auswertungen:leer] sollte (en) ohne Buchungen den Leerzustand zeigen', async () => {
    fehlschlag.aktiv = false;
    renderWithProviders(<AuswertungenPage />, { router: true, query: true, locale: 'en' });

    expect(await screen.findByText('No transactions yet')).toBeInTheDocument();
  });
});
