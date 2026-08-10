/**
 * Fehlerzustand der Finanzstadt (WP-12.1, verschärft WP 7.1).
 *
 * Die Stadt ist eine Darstellung von Geld als Gebäude. Nach einem Lesefehler
 * eine leere Stadt zu zeigen heisst: „du besitzt nichts" — in Bildern, die
 * stärker wirken als jede Zahl.
 *
 * **Was WP 7.1 ergänzt (TEST-4).** Der Fehlertext war geprüft, die Abwesenheit
 * des Leerzustands nicht. Beide Zustände laufen hier durch dieselbe Weiche
 * (`deriveCityRequestState`) — dass sie sich gegenseitig ausschliessen, ist
 * damit eine Zusicherung und keine Lesart der Reihenfolge im JSX.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/services/transaction-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getTransactions: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import CityPage from '../CityPage';

describe('Fehlerzustand der Finanzstadt', () => {
  it('[ZUSTAND /city:fehler] sollte (de) den Ladefehler benennen statt eine leere Stadt zu zeigen', async () => {
    renderWithProviders(<CityPage />, { query: true, router: true, locale: 'de' });

    await screen.findByText('Deine Buchungen konnten nicht geladen werden', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Noch keine Ausgabendaten für die Finanzstadt. Importiere oder erfasse Buchungen, um deine Stadt zu bauen.',
      ),
    ).toBeNull();
  });

  it('[ZUSTAND /city:fehler] sollte (en) den Ladefehler benennen statt eine leere Stadt zu zeigen', async () => {
    renderWithProviders(<CityPage />, { query: true, router: true, locale: 'en' });

    await screen.findByText('Your transactions could not be loaded', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.queryByText(
        'No spending data yet for the finance city. Import or add transactions to build your city.',
      ),
    ).toBeNull();
  });
});
