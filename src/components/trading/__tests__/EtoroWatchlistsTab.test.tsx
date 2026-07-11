import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import { translations } from '@/i18n/translations';
import { EtoroWatchlistsResponseSchema, EtoroPriceAlertsResponseSchema } from '@/services/etoro-api-schemas';
import { EtoroAccountError } from '@/services/etoro-account-service';
import EtoroWatchlistsTab from '../EtoroWatchlistsTab';

const watchlists = EtoroWatchlistsResponseSchema.parse({
  watchlists: [
    { watchlistId: '1', name: 'Tech Watchlist', isUserSelectedDefault: true, totalItems: 2 },
    { watchlistId: '2', name: 'Crypto', totalItems: 1 },
  ],
});

const watchlistItems = EtoroWatchlistsResponseSchema.parse({
  watchlists: [
    {
      watchlistId: '1',
      items: [
        { itemId: 1001, itemType: 'Instrument', market: { symbolName: 'AAPL', displayName: 'Apple Inc.' } },
        { itemId: 1002, itemType: 'Instrument', market: { symbolName: 'TSLA' } },
      ],
    },
  ],
});

const priceAlerts = EtoroPriceAlertsResponseSchema.parse({
  results: [{ alertId: 'a1', instrumentId: 1001, symbol: 'AAPL', targetPrice: 200, currentPrice: 182.3 }],
});

const rates = new Map([[1001, 190]]);

function noopSection<T>(data: T | undefined) {
  return { data, isLoading: false, error: null };
}

describe('EtoroWatchlistsTab', () => {
  describe('Normal Behavior', () => {
    it('sollte Watchlist-Items mit USD-Kursen anzeigen (nie EUR-Default)', () => {
      renderWithI18n(
        <EtoroWatchlistsTab
          isLocked={false}
          watchlists={noopSection(watchlists)}
          selectedWatchlistId="1"
          onSelectWatchlist={() => {}}
          watchlistItems={noopSection(watchlistItems)}
          priceAlerts={noopSection(priceAlerts)}
          rates={rates}
        />,
        'de',
      );
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
      expect(screen.getByText('TSLA')).toBeInTheDocument();
      expect(screen.getAllByText(/190,00\s*\$/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/€/)).not.toBeInTheDocument();
    });

    it('sollte einen Watchlist-Selektor zeigen, wenn mehrere Watchlists vorhanden sind', () => {
      const onSelect = () => {};
      renderWithI18n(
        <EtoroWatchlistsTab
          isLocked={false}
          watchlists={noopSection(watchlists)}
          selectedWatchlistId="1"
          onSelectWatchlist={onSelect}
          watchlistItems={noopSection(watchlistItems)}
          priceAlerts={noopSection(priceAlerts)}
          rates={rates}
        />,
        'de',
      );
      expect(screen.getByText('Tech Watchlist (2)')).toBeInTheDocument();
      expect(screen.getByText('Crypto (1)')).toBeInTheDocument();
    });

    it('sollte onSelectWatchlist beim Klick auf ein anderes Segment aufrufen', () => {
      let selected: string | undefined;
      renderWithI18n(
        <EtoroWatchlistsTab
          isLocked={false}
          watchlists={noopSection(watchlists)}
          selectedWatchlistId="1"
          onSelectWatchlist={(id) => (selected = id)}
          watchlistItems={noopSection(watchlistItems)}
          priceAlerts={noopSection(priceAlerts)}
          rates={rates}
        />,
        'de',
      );
      fireEvent.click(screen.getByText('Crypto (1)'));
      expect(selected).toBe('2');
    });

    it('sollte Kursalarme mit Zielkurs/aktuellem Kurs/Abstand anzeigen', () => {
      renderWithI18n(
        <EtoroWatchlistsTab
          isLocked={false}
          watchlists={noopSection(watchlists)}
          selectedWatchlistId="1"
          onSelectWatchlist={() => {}}
          watchlistItems={noopSection(watchlistItems)}
          priceAlerts={noopSection(priceAlerts)}
          rates={rates}
        />,
        'de',
      );
      expect(screen.getByText(/200,00\s*\$/)).toBeInTheDocument();
      // Live-Kurs (190) bevorzugt vor dem Alarm-Snapshot (182,30)
      expect(screen.getAllByText(/190,00\s*\$/).length).toBeGreaterThan(0);
    });

    it('sollte englische Labels rendern', () => {
      renderWithI18n(
        <EtoroWatchlistsTab
          isLocked={false}
          watchlists={noopSection(watchlists)}
          selectedWatchlistId="1"
          onSelectWatchlist={() => {}}
          watchlistItems={noopSection(watchlistItems)}
          priceAlerts={noopSection(priceAlerts)}
          rates={rates}
        />,
        'en',
      );
      expect(screen.getByText('Price alerts')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('sollte einen Empty-State zeigen, wenn keine Watchlists vorhanden sind', () => {
      const empty = EtoroWatchlistsResponseSchema.parse({ watchlists: [] });
      renderWithI18n(
        <EtoroWatchlistsTab
          isLocked={false}
          watchlists={noopSection(empty)}
          selectedWatchlistId={undefined}
          onSelectWatchlist={() => {}}
          watchlistItems={noopSection(undefined)}
          priceAlerts={noopSection(undefined)}
          rates={new Map()}
        />,
        'de',
      );
      expect(screen.getByText('Keine Watchlists')).toBeInTheDocument();
    });

    it('sollte einen Empty-State zeigen, wenn keine Kursalarme vorhanden sind', () => {
      const emptyAlerts = EtoroPriceAlertsResponseSchema.parse({ results: [] });
      renderWithI18n(
        <EtoroWatchlistsTab
          isLocked={false}
          watchlists={noopSection(watchlists)}
          selectedWatchlistId="1"
          onSelectWatchlist={() => {}}
          watchlistItems={noopSection(watchlistItems)}
          priceAlerts={noopSection(emptyAlerts)}
          rates={rates}
        />,
        'de',
      );
      expect(screen.getByText('Keine Kursalarme')).toBeInTheDocument();
    });

    it('sollte keinen Selektor zeigen, wenn nur eine Watchlist vorhanden ist', () => {
      const single = EtoroWatchlistsResponseSchema.parse({ watchlists: [{ watchlistId: '1', name: 'Tech Watchlist' }] });
      renderWithI18n(
        <EtoroWatchlistsTab
          isLocked={false}
          watchlists={noopSection(single)}
          selectedWatchlistId="1"
          onSelectWatchlist={() => {}}
          watchlistItems={noopSection(watchlistItems)}
          priceAlerts={noopSection(priceAlerts)}
          rates={rates}
        />,
        'de',
      );
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    });
  });

  describe('Gate-Zustände', () => {
    it('sollte bei gesperrter Verschlüsselung einen Hinweis statt Daten zeigen', () => {
      renderWithI18n(
        <EtoroWatchlistsTab
          isLocked
          watchlists={noopSection(undefined)}
          selectedWatchlistId={undefined}
          onSelectWatchlist={() => {}}
          watchlistItems={noopSection(undefined)}
          priceAlerts={noopSection(undefined)}
          rates={new Map()}
        />,
        'de',
      );
      expect(screen.getByText('Verschlüsselung gesperrt')).toBeInTheDocument();
    });

    it('[REGRESSION] sollte bei fehlendem Scope (401/403) in einer Sektion einen Berechtigungshinweis zeigen, ohne die andere Sektion zu blockieren', () => {
      renderWithI18n(
        <EtoroWatchlistsTab
          isLocked={false}
          watchlists={noopSection(watchlists)}
          selectedWatchlistId="1"
          onSelectWatchlist={() => {}}
          watchlistItems={noopSection(watchlistItems)}
          priceAlerts={{ data: undefined, isLoading: false, error: new EtoroAccountError('unauthorized', true) }}
          rates={rates}
        />,
        'de',
      );
      expect(screen.getByText('Fehlende Berechtigung')).toBeInTheDocument();
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    });
  });

  describe('i18n-Compliance (eToro Watchlists)', () => {
    it('[REGRESSION] sollte alle neuen trading.etoro.watchlists-Keys in de/en/tlh haben', () => {
      const keys = [
        'trading.etoro.tabs.watchlists',
        'trading.etoro.watchlists.title',
        'trading.etoro.watchlists.watchlistsSection',
        'trading.etoro.watchlists.emptyTitle',
        'trading.etoro.watchlists.emptyDesc',
        'trading.etoro.watchlists.itemsEmptyTitle',
        'trading.etoro.watchlists.itemsEmptyDesc',
        'trading.etoro.watchlists.alertsSection',
        'trading.etoro.watchlists.alertsEmptyTitle',
        'trading.etoro.watchlists.alertsEmptyDesc',
        'trading.etoro.watchlists.columnInstrument',
        'trading.etoro.watchlists.columnPrice',
        'trading.etoro.watchlists.columnTargetPrice',
        'trading.etoro.watchlists.columnCurrentPrice',
        'trading.etoro.watchlists.columnDistance',
        'trading.etoro.watchlists.instrumentFallback',
      ];
      const locales = [translations.de, translations.en, translations.tlh];
      keys.forEach((key) => {
        const path = key.split('.');
        locales.forEach((locale) => {
          let value = locale as Record<string, unknown>;
          path.forEach((p) => {
            expect(value[p], `${key} fehlt`).toBeDefined();
            value = value[p] as Record<string, unknown>;
          });
        });
      });
    });
  });
});
