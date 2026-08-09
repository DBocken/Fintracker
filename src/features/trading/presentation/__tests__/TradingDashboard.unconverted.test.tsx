/**
 * Fremdwährung auf der Trading-Fläche (VE-1, WP 7.7).
 *
 * Das Demo-Depot liefert im Auslieferungszustand zwei USD-Titel (AAPL, MSFT).
 * Bis WP 7.7 wanderten sie 1:1 in den EUR-Gesamtwert; jetzt stehen sie
 * sichtbar daneben als „nicht verrechnet" — der Auslieferungszustand zeigt
 * damit sowohl die Wahrheit als auch das Feature.
 *
 * Bilingual (de + en).
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

// Der Verschlüsselungs-Kontext ist für diese Frage ohne Belang, seine
// Abwesenheit würde die Fläche aber vor dem ersten Render abbrechen lassen.
vi.mock('@/hooks/useLocalEncryption', () => ({
  useLocalEncryption: () => ({ enabled: false, unlocked: true }),
}));

import TradingDashboard from '../TradingDashboard';

const EXPECTED = {
  de: 'Fremdwährung nicht verrechnet',
  en: 'Foreign currency not included',
} as const;

describe('TradingDashboard — Fremdwährung wird ausgewiesen', () => {
  it.each(['de', 'en'] as const)(
    '[REGRESSION] sollte in %s die USD-Titel des Demo-Depots als nicht verrechnet ausweisen',
    async (locale) => {
      renderWithProviders(<TradingDashboard />, { query: true, router: true, locale });

      await waitFor(() => expect(screen.getByText(EXPECTED[locale])).toBeInTheDocument(), { timeout: 4000 });

      expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
      expect(screen.getAllByText('MSFT').length).toBeGreaterThan(0);
    },
  );

  it('[REGRESSION] sollte den Gesamtwert ohne die USD-Titel ausweisen', async () => {
    renderWithProviders(<TradingDashboard />, { query: true, router: true });

    // SAP 1.455 + VOW3 1.856 + World 1.026 = 4.337,00 € — die 3.894,10 $ aus
    // AAPL/MSFT sind bewusst NICHT enthalten (vorher: 8.231,10 €).
    await waitFor(() => expect(screen.getAllByText('4.337,00 €').length).toBeGreaterThan(0), { timeout: 4000 });
    expect(screen.queryByText('8.231,10 €')).toBeNull();
  });
});
