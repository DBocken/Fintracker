/**
 * Fehlerzustand der Coach-Fläche (WP-12.1).
 *
 * Der Coach ist der Einstieg der App. Behauptet er nach einem Lesefehler
 * „fang mal an", steht der Nutzer vor der Aufforderung, Daten neu zu erfassen,
 * die längst da sind — die teuerste Form der falschen Auskunft.
 *
 * **Zur Bauart der Zusicherung.** Erst warten, dann FRISCH abfragen. Das
 * naheliegende `expect(await screen.findByText(…)).toBeInTheDocument()`
 * scheitert auf dieser Fläche: `findByText` findet den Knoten, aber bis die
 * Zusicherung ihn prüft, hat eine weitere Abfrage ihr Ergebnis geliefert und
 * React den Teilbaum ersetzt — der gehaltene Knoten hängt dann an keinem
 * Dokument mehr. Die Meldung („element could not be found in the document")
 * liest sich wie ein fehlender Fehlerzustand und ist in Wahrheit eine
 * veraltete Referenz.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/services/transaction-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getTransactions: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import CoachPage from '../CoachPage';

describe('Fehlerzustand der Coach-Fläche', () => {
  it('[ZUSTAND /coach:fehler] sollte den Ladefehler benennen statt zum Anfangen einzuladen', async () => {
    renderWithProviders(<CoachPage />, { query: true, router: true });

    await screen.findByText('Deine Daten konnten nicht geladen werden', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Noch keine Transaktionen')).toBeNull();
  });
});
