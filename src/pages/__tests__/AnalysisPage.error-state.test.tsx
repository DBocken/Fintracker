/**
 * Fehlerzustand der Auswertungs-Fläche `/premium` (WP-12.1, verschärft WP 7.1).
 *
 * Auswertungen aus leeren Daten sehen wie Auswertungen aus: Achsen, Legenden,
 * Prozentzahlen — nur eben alle null. Das ist die stillste Art, falsch zu
 * informieren.
 *
 * **Warum die Anwesenheit des Fehlers nicht reicht (WP 7.1, TEST-4).** Bis
 * hierher fragte dieser Test nur, ob es irgendwo ein `role="alert"` gibt. Grün
 * wäre er damit auch dann, wenn BEIDE Aussagen gleichzeitig dastehen — der
 * Fehlerhinweis oben, die Auswertung aus Nullen darunter. Genau diese
 * Gleichzeitigkeit war der reale Befund in `AccountManager` (WP 6.5a). Deshalb
 * prüft der Test jetzt beides: dass der Ladefehler benannt ist UND dass die
 * irreführende Aussage verschwunden ist.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/services/transaction-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getTransactions: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import AnalysisPage from '../AnalysisPage';

describe('Fehlerzustand der Auswertungs-Fläche', () => {
  it('[ZUSTAND /premium:fehler] sollte (de) den Ladefehler benennen statt Auswertungen aus Nullen', async () => {
    renderWithProviders(<AnalysisPage />, { query: true, router: true, locale: 'de' });

    await screen.findByText('Deine Daten konnten nicht geladen werden', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    // Der irreführende „Leerzustand" dieser Fläche ist kein Satz, sondern die
    // Auswertung selbst: Überschriften und Diagramme, gerechnet aus nichts.
    expect(screen.queryByText('Wohin fließt mein Geld?')).toBeNull();
    expect(screen.queryByText('Keine Ausgaben')).toBeNull();
  });

  it('[ZUSTAND /premium:fehler] sollte (en) den Ladefehler benennen statt Auswertungen aus Nullen', async () => {
    renderWithProviders(<AnalysisPage />, { query: true, router: true, locale: 'en' });

    await screen.findByText('Your data could not be loaded', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Where does my money flow?')).toBeNull();
    expect(screen.queryByText('No expenses')).toBeNull();
  });
});
