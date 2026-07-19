import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/I18nProvider';
import { LocalEncryptionProvider } from '@/components/providers/LocalEncryptionProvider';
import {
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  findLayoutOverlapViolations,
} from '@/test-utils/layout-overlap';

/**
 * Repo-weiter Layout-Überlappungs-Sweep: rendert JEDE renderbare Seite der App
 * und prüft den kompletten DOM (inkl. Portale in document.body) mit dem
 * generischen Wächter aus `@/test-utils/layout-overlap` — je einmal für den
 * mobilen (360px) und den Desktop-Viewport (1280px). So ist „Elemente
 * überlagern sich nicht" eine allgemeine Invariante über alle UI-Elemente,
 * nicht eine Einzelfall-Prüfung pro Komponente.
 *
 * Bewusst NICHT im Sweep (kein stiller Ausschluss):
 * - CityPage: three.js/WebGL — in jsdom nicht renderbar.
 * - Login: Supabase-Auth-UI benötigt einen konfigurierten Client.
 * - Unlock/BankCallbackPage: eigene Security-Testsuiten decken sie ab;
 *   BankCallback leitet sofort um und rendert keine eigene Fläche.
 */

vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

globalThis.ResizeObserver ||= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

/** Simulierter Viewport für window.innerWidth und min-/max-width-Media-Queries. */
let viewportWidth = DESKTOP_VIEWPORT;

function matchMediaStub(query: string): MediaQueryList {
  const evaluate = () => {
    const min = query.match(/\(min-width:\s*(\d+(?:\.\d+)?)px\)/);
    const max = query.match(/\(max-width:\s*(\d+(?:\.\d+)?)px\)/);
    if (!min && !max) return query.includes('prefers-reduced-motion');
    if (min && viewportWidth < parseFloat(min[1])) return false;
    if (max && viewportWidth > parseFloat(max[1])) return false;
    return true;
  };
  return {
    get matches() {
      return evaluate();
    },
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
}

const PAGES: Array<[string, () => Promise<{ default: React.ComponentType }>]> = [
  ['CoachPage', () => import('@/pages/CoachPage')],
  ['DebtsPage', () => import('@/pages/DebtsPage')],
  ['NetWorthPage', () => import('@/pages/NetWorthPage')],
  ['LiquidityPage', () => import('@/pages/LiquidityPage')],
  ['MilestonesPage', () => import('@/pages/MilestonesPage')],
  ['BudgetsPage', () => import('@/pages/BudgetsPage')],
  ['DashboardPage', () => import('@/pages/DashboardPage')],
  ['IncomePage', () => import('@/pages/IncomePage')],
  ['TransactionsPage', () => import('@/pages/TransactionsPage')],
  ['TaxReportPage', () => import('@/pages/TaxReportPage')],
  ['EuerPage', () => import('@/pages/EuerPage')],
  ['TradingPage', () => import('@/pages/TradingPage')],
  ['AccountsPage', () => import('@/pages/AccountsPage')],
  ['CsvPage', () => import('@/pages/CsvPage')],
  ['ExportPage', () => import('@/pages/ExportPage')],
  ['SettingsPage', () => import('@/pages/SettingsPage')],
  ['PrivacyPage', () => import('@/pages/PrivacyPage')],
  ['AnalysisPage', () => import('@/pages/AnalysisPage')],
  ['SimulationPage', () => import('@/pages/SimulationPage')],
  ['ContractsPage', () => import('@/pages/ContractsPage')],
  ['IncomeWrappedPage', () => import('@/pages/IncomeWrappedPage')],
];

async function renderPageAt(
  load: () => Promise<{ default: React.ComponentType }>,
  width: number,
): Promise<void> {
  viewportWidth = width;
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
  const { default: Page } = await load();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        <I18nProvider initialLocale="de">
          <LocalEncryptionProvider>
            <MemoryRouter>
              <Page />
            </MemoryRouter>
          </LocalEncryptionProvider>
        </I18nProvider>
      </QueryClientProvider>,
    );
    // Queries/Effekte kurz auslaufen lassen, damit auch nachgeladene
    // Inhalte (Empty States, Listen) im geprüften DOM stehen.
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

describe('Layout-Überlappungs-Sweep über alle Seiten', () => {
  beforeEach(() => {
    window.matchMedia = matchMediaStub as typeof window.matchMedia;
  });

  afterEach(() => {
    cleanup();
  });

  describe('[MOBILE] mobiler Viewport (360px)', () => {
    for (const [name, load] of PAGES) {
      it(`sollte auf ${name} keine überlappenden Layout-Elemente haben`, async () => {
        await renderPageAt(load, MOBILE_VIEWPORT);
        const violations = findLayoutOverlapViolations(document.body, MOBILE_VIEWPORT);
        expect(violations, violations.map((v) => `${v.type}: ${v.detail}\n${v.element}`).join('\n')).toEqual([]);
      });
    }
  });

  describe('Desktop-Viewport (1280px)', () => {
    for (const [name, load] of PAGES) {
      it(`sollte auf ${name} keine überlappenden Layout-Elemente haben`, async () => {
        await renderPageAt(load, DESKTOP_VIEWPORT);
        const violations = findLayoutOverlapViolations(document.body, DESKTOP_VIEWPORT);
        expect(violations, violations.map((v) => `${v.type}: ${v.detail}\n${v.element}`).join('\n')).toEqual([]);
      });
    }
  });
});
