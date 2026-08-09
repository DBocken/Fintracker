/**
 * WP-9.2 — „leer" ist nicht „nicht ladbar", auch auf dem Dashboard.
 *
 * Dieselbe Verwechslung wie auf der Buchungsseite: `const { data: txs = [] }`
 * liess einen Lesefehler als „noch keine Daten" erscheinen. Auf dem Dashboard
 * wiegt das schwerer, weil es der Einstiegsscreen ist — der erste Eindruck
 * nach einem Fehlschlag wäre „meine App ist leer".
 *
 * Der Test geht durch das ECHTE ViewModel (nur die Datenquelle scheitert),
 * nicht durch eine Attrappe des Modells. Eine Attrappe würde nur beweisen,
 * dass `Dashboard` ein Flag auswertet, das ihr jemand hineingereicht hat —
 * nicht, dass der Hook es bei einem echten Fehlschlag auch setzt.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/services/transaction-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getTransactions: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

// Schwere Kinder ausblenden: geprueft wird genau die Weiche, nicht der Aufbau
// des Dashboards. Im Fehlerfall werden sie ohnehin nicht gerendert.
vi.mock('@/features/dashboard/presentation/desktop/DashboardDesktopView', () => ({
  DashboardDesktopView: () => <div />,
}));
vi.mock('@/features/dashboard/presentation/mobile/DashboardMobileStory', () => ({
  default: () => <div />,
}));

import { Dashboard } from '../Dashboard';

describe('Dashboard — Fehlerzustand (WP-9.2)', () => {
  it('[REGRESSION] [ZUSTAND /dashboard:fehler] sollte einen Ladefehler benennen statt „keine Daten" zu behaupten', async () => {
    renderWithProviders(<Dashboard />, { query: true });

    expect(
      await screen.findByText('Deine Daten konnten nicht geladen werden'),
    ).toBeInTheDocument();
    // WP 7.1: Der Fehlertext allein beweist nicht, dass der Leerzustand weg
    // ist — beide könnten untereinander stehen (WP 6.5a, `AccountManager`).
    // Auf dem Einstiegsscreen wäre „Noch keine Transaktionen" der erste
    // Eindruck nach einem Fehlschlag: „meine App ist leer".
    expect(screen.queryByText('Noch keine Transaktionen')).toBeNull();
  });

  it('[ZUSTAND /dashboard:fehler] sollte (en) einen Ladefehler benennen statt „keine Daten" zu behaupten', async () => {
    renderWithProviders(<Dashboard />, { query: true, locale: 'en' });

    expect(await screen.findByText('Your data could not be loaded')).toBeInTheDocument();
    expect(screen.queryByText('No transactions yet')).toBeNull();
  });

  it('sollte den Fehler als solchen auszeichnen', async () => {
    // `role="alert"` ist der Unterschied zwischen „steht irgendwo auf der
    // Seite" und „wird angesagt". Ohne ihn erfaehrt eine Sprachausgabe den
    // Wechsel vom Skelett zum Fehler nicht.
    renderWithProviders(<Dashboard />, { query: true });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
