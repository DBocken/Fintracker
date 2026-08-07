/**
 * Fehlerzustand der Einnahmen-Fläche (WP-12.1).
 *
 * [REGRESSION] Hier stand der Befund aus WP-9.1 noch unbemerkt im Code: Der
 * Leerzustand wurde VOR dem Fehlerblock zurückgegeben, und weil ein
 * gescheiterter Lesevorgang dieselbe leere Liste hinterlässt wie ein leerer
 * Speicher, gewann er immer. Der Fehlerblock darunter war unerreichbar — die
 * Seite sagte „noch keine Einnahmen", wo sie „nicht ladbar" meinte.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/services/transaction-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getTransactions: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import IncomePage from '../IncomePage';

describe('Fehlerzustand der Einnahmen-Fläche', () => {
  it('[REGRESSION] [ZUSTAND /income:fehler] sollte den Ladefehler benennen statt „noch keine Einnahmen"', async () => {
    renderWithProviders(<IncomePage />, { query: true, router: true });

    await screen.findByText('Deine Buchungen konnten nicht geladen werden', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Noch keine Transaktionen')).toBeNull();
  });
});
