import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/I18nProvider';
import { useI18n } from '@/i18n/useI18n';
import { LocalEncryptionProvider } from '@/components/providers/LocalEncryptionProvider';
import { localEncryption } from '@/services/local-crypto';
import { createPortfolio } from '@/services/portfolio-service';
import TradingDashboard from '../TradingDashboard';

// Recharts' ResponsiveContainer misst in jsdom eine Breite von 0 und rendert
// dann GAR NICHTS (siehe TradingDashboard.performanceTab.test.tsx) — das
// Diagramm selbst ist also im Test unsichtbar. Um trotzdem zu belegen, dass
// `performancePreviewChartData` (PERF-4: aus dem JSX in ein useMemo gezogen)
// bei geänderter Quelle wirklich neu berechnet wird, wird `LineChart` durch
// einen Stub ersetzt, der genau die Prop zeigt, die produktiv an Recharts
// geht — die zugängliche ChartFigure-Tabelle daneben nutzt bewusst das
// unformatierte `performancePreview` (eigene Spalten-`format`-Funktion) und
// ist damit NICHT dieselbe Datenquelle wie das Diagramm.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container-stub">{children}</div>
    ),
    LineChart: ({ data }: { data: Array<{ day: number | null; value: number; label: string }> }) => (
      <div data-testid="line-chart-data">{JSON.stringify(data)}</div>
    ),
  };
});

beforeAll(() => {
  globalThis.ResizeObserver ||= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

vi.mock('@/services/etoro-account-service', async () => {
  const actual = await vi.importActual<typeof import('../../../services/etoro-account-service')>(
    '../../../services/etoro-account-service',
  );
  return {
    ...actual,
    fetchEtoroAggregateForPortfolio: vi.fn().mockResolvedValue({}),
    fetchEtoroTradeHistoryForPortfolio: vi.fn().mockResolvedValue([]),
    fetchEtoroPnlForPortfolio: vi.fn().mockResolvedValue({}),
    fetchEtoroBalancesForPortfolio: vi.fn().mockResolvedValue({ balances: [] }),
    fetchEtoroBalancesHistoryForPortfolio: vi.fn().mockResolvedValue({ snapshots: [] }),
    fetchEtoroCashTransactionsForPortfolio: vi.fn().mockResolvedValue({ results: [], pagination: { pageSize: 50, hasNext: false } }),
  };
});

/** Testharnisch: erlaubt einen Sprachwechsel ZUR LAUFZEIT, ohne TradingDashboard
 *  neu zu mounten (ein Remount würde jeden lokalen State zurücksetzen und
 *  damit nichts über die Memo-Abhängigkeiten aussagen). */
function LocaleSwitchHarness() {
  const { setLocale } = useI18n();
  return (
    <button type="button" onClick={() => setLocale('en')}>
      switch-to-en
    </button>
  );
}

function renderDashboard(locale: 'de' | 'en' = 'de') {
  window.localStorage.setItem('ausgabentracker_locale_v1', locale);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider initialLocale={locale}>
        <LocalEncryptionProvider>
          <LocaleSwitchHarness />
          <TradingDashboard />
        </LocalEncryptionProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('TradingDashboard — performancePreviewChartData (PERF-4)', () => {
  beforeEach(() => {
    localEncryption.lock();
    window.localStorage.clear();
  });

  it('[REGRESSION] sollte die an Recharts übergebenen Datenpunkte bei Sprachwechsel neu beschriften, ohne die Werte zu verändern', async () => {
    await createPortfolio({ name: 'Manuell', type: 'manual', currency: 'EUR', is_active: true });

    renderDashboard('de');

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Performance' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('tab', { name: 'Performance' }));

    await waitFor(() => expect(screen.getByTestId('line-chart-data')).toBeInTheDocument());
    const before = JSON.parse(screen.getByTestId('line-chart-data').textContent || '[]') as Array<{
      day: number | null;
      value: number;
      label: string;
    }>;
    expect(before.length).toBeGreaterThan(1);
    expect(before[1]).toMatchObject({ day: 1, label: 'Tag 1' });

    await userEvent.click(screen.getByRole('button', { name: 'switch-to-en' }));

    await waitFor(() => {
      const after = JSON.parse(screen.getByTestId('line-chart-data').textContent || '[]') as Array<{
        day: number | null;
        value: number;
        label: string;
      }>;
      expect(after[1]).toMatchObject({ day: 1, label: 'Day 1' });
    });

    const after = JSON.parse(screen.getByTestId('line-chart-data').textContent || '[]') as Array<{
      day: number | null;
      value: number;
      label: string;
    }>;
    // Die Werte selbst (nicht nur die Beschriftung) müssen unverändert
    // bleiben — der Sprachwechsel darf performancePreview nicht neu würfeln.
    expect(after.map((p) => p.value)).toEqual(before.map((p) => p.value));
  });
});
