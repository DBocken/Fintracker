/**
 * Zustände der Budget-Fläche (WP-12.1).
 *
 * Leer und Fehler stehen bewusst in EINER Datei und werden gegeneinander
 * geprüft: Der Befund aus WP-9.1 war nicht, dass eine Aussage fehlte, sondern
 * dass die falsche kam — „Noch keine Budgets" nach einem Lesefehler. Ein Test,
 * der nur die Anwesenheit des Leerzustands prüft, hätte das nie bemerkt.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

/**
 * Umschalter statt `mockRejectedValue`: Letzteres erzeugt die abgelehnte
 * Zusage sofort bei der Zuweisung — sie gilt bis zum ersten Aufruf als
 * unbehandelt und laesst den Test scheitern, bevor er etwas prueft. Hier
 * entsteht die Ablehnung erst im Aufruf, also innerhalb der Reichweite von
 * TanStack Query.
 */
const modus = vi.hoisted(() => ({ fehler: false }));

vi.mock('@/services/budget-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getBudgetOverview: () =>
    modus.fehler
      ? Promise.reject(new Error('IndexedDB nicht erreichbar'))
      : Promise.resolve({ statuses: [], suggestions: [] }),
}));

import BudgetsPage from '../BudgetsPage';

describe('Zustände der Budget-Fläche', () => {
  beforeEach(() => {
    modus.fehler = false;
  });

  it('[ZUSTAND /budgets:leer] sollte ohne Budgets zum Anlegen einladen — und keinen Fehler behaupten', async () => {
    renderWithProviders(<BudgetsPage />, { query: true, router: true });

    expect(await screen.findByText('Noch keine Budgets')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('[ZUSTAND /budgets:fehler] sollte den Ladefehler benennen statt „noch keine Budgets"', async () => {
    modus.fehler = true;

    renderWithProviders(<BudgetsPage />, { query: true, router: true });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // Die Gegenprobe ist der eigentliche Test: Ein leerer Budget-Screen liest
    // sich wie „du hast noch nichts eingerichtet" — eine Einladung, wo eine
    // Warnung hingehoert.
    expect(screen.queryByText('Noch keine Budgets')).toBeNull();
  });
});
