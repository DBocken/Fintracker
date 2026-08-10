/**
 * WP 6.3 — die Trading-Fläche liegt in ihrer Slice, aufgeteilt entlang der Tabs.
 *
 * ARCH-5/KOMP-1: `TradingDashboard.tsx` überlebte die Slice-Migration als
 * 746-Zeilen-Komponente in der Alt-Oberfläche. Die Slice `features/trading` hatte
 * `domain/` und `application/`, aber keine `presentation/` — die Kette endete
 * eine Schicht zu früh.
 *
 * Dieser Test verlangt beides: den neuen Ort UND die Aufteilung. Er ist die rote
 * Aussage des Pakets; das Verhaltens-Sicherheitsnetz steht in
 * `src/pages/__tests__/TradingPage.tabs.test.tsx` und ist vor wie nach dem Umzug
 * grün.
 *
 * Bilingual (de + en) über `@/test-utils/render`.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/hooks/useLocalEncryption', () => ({
  useLocalEncryption: () => ({ enabled: false, unlocked: true }),
}));

import TradingDashboard from '../TradingDashboard';
import TradingHeader from '../shared/TradingHeader';
import TradingSummaryStats from '../shared/TradingSummaryStats';
import TradingPositionsTab from '../tabs/TradingPositionsTab';
import TradingPerformanceTab from '../tabs/TradingPerformanceTab';
import TradingPortfoliosTab from '../tabs/TradingPortfoliosTab';
import EtoroTabPanels from '../tabs/EtoroTabPanels';

const TABS = {
  de: ['Positionen', 'Performance', 'Portfolios verwalten'],
  en: ['Positions', 'Performance', 'Manage portfolios'],
} as const;

describe('features/trading/presentation (WP 6.3)', () => {
  it('sollte die Fläche entlang der Tabs in eigene Bausteine zerlegt haben', () => {
    // Kopfzeile, Kennzahlen und je Tab ein Baustein — kein 746-Zeilen-Block mehr.
    for (const baustein of [
      TradingHeader,
      TradingSummaryStats,
      TradingPositionsTab,
      TradingPerformanceTab,
      TradingPortfoliosTab,
      EtoroTabPanels,
    ]) {
      expect(typeof baustein).toBe('function');
    }
  });

  it.each(['de', 'en'] as const)(
    '[REGRESSION] sollte in %s aus der Slice heraus dieselbe Tab-Leiste rendern',
    async (locale) => {
      renderWithProviders(<TradingDashboard />, { query: true, router: true, locale });

      for (const label of TABS[locale]) {
        await waitFor(() => expect(screen.getByRole('tab', { name: label })).toBeInTheDocument());
      }
      expect(screen.getAllByRole('tab')).toHaveLength(TABS[locale].length);
    },
  );
});
