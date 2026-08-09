/**
 * WP 6.3 — Sicherheitsnetz für die Aufspaltung von `TradingDashboard`.
 *
 * Der Screen zieht aus `src/components/trading/TradingDashboard.tsx` (746
 * Zeilen, ARCH-5/KOMP-1) in `src/features/trading/presentation/` und wird dabei
 * entlang der Tabs zerlegt. Dieser Test hält fest, WAS die Route zeigt — die
 * Tab-Leiste und den Inhalt des voreingestellten Tabs — damit die Zerlegung
 * eine reine Umschichtung bleibt.
 *
 * Er ist bewusst KEIN roter Test: Ein Regressionstest für einen Umzug muss vor
 * UND nach dem Umzug grün sein, sonst prüft er den Umzug nicht, sondern etwas
 * anderes. Rot läuft die Strukturaussage daneben
 * (`src/features/trading/presentation/__tests__/TradingDashboard.slice.test.tsx`),
 * die den neuen Ort verlangt.
 *
 * Bilingual (de + en) über `@/test-utils/render` — die Tab-Beschriftungen sind
 * übersetzter Text, ein einsprachiger Test würde eine fehlende Übersetzung
 * beim Umzug nicht bemerken.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/hooks/useLocalEncryption', () => ({
  useLocalEncryption: () => ({ enabled: false, unlocked: true }),
}));

import TradingPage from '../TradingPage';

/** Beschriftungen der drei Tabs, die JEDES Depot hat (die eToro-Tabs kommen nur bei eToro-Depots dazu). */
const TABS = {
  de: ['Positionen', 'Performance', 'Portfolios verwalten'],
  en: ['Positions', 'Performance', 'Manage portfolios'],
} as const;

/** Kopfzeile über den Tabs — sie bleibt bei der Aufspaltung erhalten. */
const TITLE = { de: 'Trading Portfolio', en: 'Trading Portfolio' } as const;

/** Untertitel — belegt, dass die Kopfzeile mitsamt ihrem Text übergesiedelt ist. */
const SUBTITLE = {
  de: 'Verwalten Sie Ihre Investitionen und verfolgen Sie die Performance',
  en: 'Manage your investments and track your performance',
} as const;

describe('TradingPage — Tab-Leiste und Voreinstellung (WP 6.3)', () => {
  it.each(['de', 'en'] as const)(
    '[REGRESSION] sollte in %s dieselben Tabs mit demselben Inhalt zeigen',
    async (locale) => {
      renderWithProviders(<TradingPage />, { query: true, router: true, locale });

      for (const label of TABS[locale]) {
        await waitFor(() => expect(screen.getByRole('tab', { name: label })).toBeInTheDocument());
      }

      // Ohne eToro-Depot gibt es genau diese drei Tabs — keinen mehr.
      expect(screen.getAllByRole('tab')).toHaveLength(TABS[locale].length);

      // Voreinstellung: ein Depot ohne eToro startet auf „Positionen".
      expect(screen.getByRole('tab', { name: TABS[locale][0] })).toHaveAttribute(
        'aria-selected',
        'true',
      );

      expect(screen.getByRole('heading', { name: TITLE[locale] })).toBeInTheDocument();
      expect(screen.getByText(SUBTITLE[locale])).toBeInTheDocument();
    },
  );
});
