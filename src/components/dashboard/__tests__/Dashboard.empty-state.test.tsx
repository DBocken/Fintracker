/**
 * Leerzustand des Dashboards (WP-12.1) — Gegenstück zu
 * `Dashboard.error-state.test.tsx`.
 *
 * Das Dashboard ist der Einstiegsscreen. Die Gegenprobe auf `role="alert"`
 * hält fest, dass hier die Einladung steht und nicht versehentlich eine
 * Fehlermeldung: Beides sieht auf den ersten Blick nach „hier ist nichts" aus.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

// Schwere Kinder ausblenden — geprueft wird die Weiche, nicht der Aufbau
// (dieselbe Begruendung wie im Fehlerzustands-Test).
vi.mock('@/features/dashboard/presentation/desktop/DashboardDesktopView', () => ({
  DashboardDesktopView: () => <div />,
}));
vi.mock('@/features/dashboard/presentation/mobile/DashboardMobileStory', () => ({
  default: () => <div />,
}));

import { Dashboard } from '../Dashboard';

describe('Dashboard — Leerzustand (WP-12.1)', () => {
  it('[ZUSTAND /dashboard:leer] sollte ohne Buchungen zum Importieren einladen — und keinen Fehler behaupten', async () => {
    renderWithProviders(<Dashboard />, { query: true });

    await screen.findByText('Noch keine Transaktionen', {}, { timeout: 4000 });

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
