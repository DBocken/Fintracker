import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/I18nProvider';
import { LocalEncryptionProvider } from '@/components/providers/LocalEncryptionProvider';
import { localEncryption } from '@/services/local-crypto';
import { createPortfolio } from '@/services/portfolio-service';
import TradingDashboard from '../TradingDashboard';

// Recharts' ResponsiveContainer braucht ResizeObserver, den jsdom nicht kennt.
beforeAll(() => {
  globalThis.ResizeObserver ||= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

vi.mock('@/services/etoro-account-service', async () => {
  const actual = await vi.importActual<typeof import('@/services/etoro-account-service')>(
    '@/services/etoro-account-service',
  );
  return {
    ...actual,
    fetchEtoroAggregateForPortfolio: vi.fn().mockResolvedValue({}),
    fetchEtoroTradeHistoryForPortfolio: vi.fn().mockResolvedValue([]),
    fetchEtoroPnlForPortfolio: vi.fn().mockResolvedValue({}),
    fetchEtoroBalancesForPortfolio: vi.fn().mockResolvedValue({ balances: [] }),
    fetchEtoroBalancesHistoryForPortfolio: vi.fn().mockResolvedValue({
      snapshots: [
        { date: '2026-06-01', displayTotalBalance: 5000 },
        { date: '2026-06-15', displayTotalBalance: 5400 },
      ],
    }),
    fetchEtoroCashTransactionsForPortfolio: vi.fn().mockResolvedValue({ results: [], pagination: { pageSize: 50, hasNext: false } }),
  };
});

function renderDashboard(locale: 'de' | 'en' = 'de') {
  window.localStorage.setItem('ausgabentracker_locale_v1', locale);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <LocalEncryptionProvider>
          <TradingDashboard />
        </LocalEncryptionProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('TradingDashboard — Performance-Tab', () => {
  beforeEach(() => {
    // localEncryption.lock() allein reicht nicht: die "enabled"-Config liegt
    // in localStorage, nicht im (nach jedem Test geleerten) IndexedDB-KV-Store
    // — ohne expliziten Reset bliebe "enabled" über Tests hinweg bestehen.
    localEncryption.lock();
    window.localStorage.clear();
  });

  describe('[REGRESSION] eToro-Portfolios zeigen nie mehr synthetische Performance-Daten', () => {
    it('sollte für ein eToro-Portfolio den echten Kontostand-Verlauf statt des Mocks anzeigen', async () => {
      await localEncryption.enable('test-passwort-123');
      await createPortfolio({
        name: 'eToro',
        type: 'etoro',
        provider_config: { apiKey: 'k1', userKey: 'k2' },
        currency: 'USD',
        is_active: true,
      });

      renderDashboard('de');

      await waitFor(() => expect(screen.getByRole('tab', { name: 'Performance' })).toBeInTheDocument());
      await userEvent.click(screen.getByRole('tab', { name: 'Performance' }));

      await waitFor(() => expect(screen.getByText(/eToro-Kontostand-Snapshots/)).toBeInTheDocument());
      expect(screen.queryByText(/Simulierter Verlauf/)).not.toBeInTheDocument();
    });
  });

  describe('Normal Behavior (nicht-eToro bleibt unverändert)', () => {
    it('sollte für ein manuelles Portfolio weiterhin den simulierten Chart-Hinweis zeigen', async () => {
      await createPortfolio({
        name: 'Manuell',
        type: 'manual',
        currency: 'EUR',
        is_active: true,
      });

      renderDashboard('de');

      await waitFor(() => expect(screen.getByRole('tab', { name: 'Performance' })).toBeInTheDocument());
      await userEvent.click(screen.getByRole('tab', { name: 'Performance' }));

      await waitFor(() => expect(screen.getByText(/Simulierter Verlauf/)).toBeInTheDocument());
    });
  });
});
