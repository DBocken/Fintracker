/**
 * Fehlerzustand der EÜR-Fläche (WP-12.1).
 *
 * „Noch keine Betriebsdaten" nach einem Lesefehler ist hier besonders heikel:
 * Die EÜR ist eine steuerliche Aufstellung. Wer ihr glaubt, meldet zu wenig.
 *
 * Zur Bauart: erst warten, dann FRISCH abfragen — ein gehaltener Knoten kann
 * bis zur Zusicherung durch einen Folge-Render ersetzt worden sein (siehe
 * CoachPage.error-state.test.tsx).
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/services/transaction-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getTransactions: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import EuerPage from '../EuerPage';

describe('Fehlerzustand der EÜR-Fläche', () => {
  it('[ZUSTAND /euer:fehler] sollte den Ladefehler benennen statt „noch keine Betriebsdaten"', async () => {
    renderWithProviders(<EuerPage />, { query: true, router: true });

    await screen.findByText('Deine Buchungen konnten nicht geladen werden', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Noch keine Betriebsdaten')).toBeNull();
  });
});
