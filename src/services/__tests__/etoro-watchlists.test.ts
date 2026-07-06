import { describe, it, expect } from 'vitest';
import { EtoroWatchlistsResponseSchema, EtoroPriceAlertsResponseSchema } from '../etoro-api-schemas';
import { selectWatchlistSummaries, selectWatchlistItems, selectPriceAlerts } from '../etoro-watchlists';

describe('selectWatchlistSummaries', () => {
  describe('Normal Behavior', () => {
    it('sollte Name, Default-Flag und Item-Anzahl je Watchlist abbilden', () => {
      const response = EtoroWatchlistsResponseSchema.parse({
        watchlists: [
          { watchlistId: '1', name: 'Tech Watchlist', isUserSelectedDefault: true, totalItems: 42 },
          { watchlistId: '2', name: 'Crypto', isDefault: false },
        ],
      });

      const summaries = selectWatchlistSummaries(response);
      expect(summaries).toEqual([
        { watchlistId: '1', name: 'Tech Watchlist', isDefault: true, itemCount: 42 },
        { watchlistId: '2', name: 'Crypto', isDefault: false, itemCount: 0 },
      ]);
    });

    it('sollte itemCount aus items.length ableiten, wenn totalItems fehlt', () => {
      const response = EtoroWatchlistsResponseSchema.parse({
        watchlists: [{ watchlistId: '1', items: [{ itemId: 1, itemType: 'Instrument' }] }],
      });
      expect(selectWatchlistSummaries(response)[0].itemCount).toBe(1);
    });

    it('sollte watchlistId als Namen-Fallback verwenden, wenn name fehlt', () => {
      const response = EtoroWatchlistsResponseSchema.parse({ watchlists: [{ watchlistId: '99' }] });
      expect(selectWatchlistSummaries(response)[0].name).toBe('99');
    });
  });

  describe('Edge Cases', () => {
    it('sollte [] liefern, wenn response undefined ist', () => {
      expect(selectWatchlistSummaries(undefined)).toEqual([]);
    });
  });
});

describe('selectWatchlistItems', () => {
  describe('Normal Behavior', () => {
    it('sollte Instrument-Items mit gemergtem Live-Kurs abbilden', () => {
      const response = EtoroWatchlistsResponseSchema.parse({
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
      const rates = new Map([[1001, 190.5]]);

      const items = selectWatchlistItems(response, rates);
      expect(items).toEqual([
        { itemId: 1001, symbol: 'AAPL', name: 'Apple Inc.', price: 190.5 },
        { itemId: 1002, symbol: 'TSLA', name: undefined, price: undefined },
      ]);
    });

    it('sollte Nicht-Instrument-Items (z. B. "Person") ausblenden', () => {
      const response = EtoroWatchlistsResponseSchema.parse({
        watchlists: [{ watchlistId: '1', items: [{ itemId: 1, itemType: 'Person' }] }],
      });
      expect(selectWatchlistItems(response, new Map())).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('sollte [] liefern, wenn response undefined ist', () => {
      expect(selectWatchlistItems(undefined, new Map())).toEqual([]);
    });

    it('sollte [] liefern, wenn die erste Watchlist keine Items hat', () => {
      const response = EtoroWatchlistsResponseSchema.parse({ watchlists: [{ watchlistId: '1' }] });
      expect(selectWatchlistItems(response, new Map())).toEqual([]);
    });
  });
});

describe('selectPriceAlerts', () => {
  describe('Normal Behavior', () => {
    it('sollte den Abstand zum Zielkurs anhand des Live-Kurses berechnen, wenn vorhanden', () => {
      const response = EtoroPriceAlertsResponseSchema.parse({
        results: [{ alertId: 'a1', instrumentId: 1001, symbol: 'AAPL', targetPrice: 200, currentPrice: 182.3 }],
      });
      const rates = new Map([[1001, 190]]);

      const [alert] = selectPriceAlerts(response, rates);
      expect(alert.livePrice).toBe(190);
      // (200-190)/190*100 ≈ 5.26%
      expect(alert.distancePercent).toBeCloseTo(5.263, 2);
    });

    it('sollte auf currentPrice zurückfallen, wenn kein Live-Kurs aufgelöst ist', () => {
      const response = EtoroPriceAlertsResponseSchema.parse({
        results: [{ alertId: 'a1', instrumentId: 1001, symbol: 'AAPL', targetPrice: 200, currentPrice: 182.3 }],
      });

      const [alert] = selectPriceAlerts(response, new Map());
      expect(alert.livePrice).toBeUndefined();
      // (200-182.3)/182.3*100 ≈ 9.71%
      expect(alert.distancePercent).toBeCloseTo(9.71, 1);
    });
  });

  describe('Edge Cases', () => {
    it('sollte [] liefern, wenn response undefined ist', () => {
      expect(selectPriceAlerts(undefined, new Map())).toEqual([]);
    });

    it('sollte distancePercent=0 liefern, wenn der Referenzpreis 0 ist', () => {
      const response = EtoroPriceAlertsResponseSchema.parse({
        results: [{ alertId: 'a1', instrumentId: 1001, symbol: 'AAPL', targetPrice: 200, currentPrice: 0 }],
      });
      expect(selectPriceAlerts(response, new Map())[0].distancePercent).toBe(0);
    });
  });
});
