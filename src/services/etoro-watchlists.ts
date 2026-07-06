import type { EtoroWatchlistsResponse, EtoroPriceAlertsResponse } from './etoro-api-schemas';

// -----------------------------------------------------------------------------
// Watchlists & Kursalarme — reine Selektor-Funktionen über die Antworten aus
// etoro-api-schemas.ts. Keine Netzwerk-/Persistenz-Logik hier, nur Ableitung
// fürs UI (EtoroWatchlistsTab), analog etoro-mirrors.ts.
//
// Live-Kurse (rates: Map<instrumentId, price>) kommen vom bestehenden
// fetchEtoroRates (etoro-service.ts) — hier nur gemergt, nicht selbst geladen.
// -----------------------------------------------------------------------------

export interface WatchlistSummaryView {
  watchlistId: string;
  name: string;
  isDefault: boolean;
  itemCount: number;
}

/** Bildet die Liste der Watchlists (Namen + Metadaten) für einen Auswahl-Selektor ab. */
export function selectWatchlistSummaries(response: EtoroWatchlistsResponse | undefined): WatchlistSummaryView[] {
  const watchlists = response?.watchlists ?? [];

  return watchlists.map((w) => ({
    watchlistId: w.watchlistId,
    name: w.name || w.watchlistId,
    isDefault: w.isUserSelectedDefault ?? w.isDefault ?? false,
    itemCount: w.totalItems ?? w.items?.length ?? 0,
  }));
}

export interface WatchlistItemView {
  itemId: number;
  symbol: string | undefined;
  name: string | undefined;
  /** Live-Kurs aus fetchEtoroRates, falls aufgelöst — sonst kein aktueller Preis verfügbar. */
  price: number | undefined;
}

/**
 * Bildet die Instrument-Items der (aktuell ausgewählten) Watchlist ab und
 * mergt Live-Kurse ein. Nicht-Instrument-Items (z. B. "Person"/Trader) werden
 * ausgeblendet — die Watchlists-Ansicht zeigt nur handelbare Instrumente.
 */
export function selectWatchlistItems(
  response: EtoroWatchlistsResponse | undefined,
  rates: Map<number, number>,
): WatchlistItemView[] {
  const items = response?.watchlists?.[0]?.items ?? [];

  return items
    .filter((item) => item.itemType === 'Instrument')
    .map((item) => ({
      itemId: item.itemId,
      symbol: item.market?.symbolName,
      name: item.market?.displayName,
      price: rates.get(item.itemId),
    }));
}

export interface PriceAlertView {
  alertId: string;
  instrumentId: number;
  symbol: string;
  targetPrice: number;
  /** Kurs zum Zeitpunkt der letzten Alarm-Aktualisierung (eToro-Snapshot). */
  currentPrice: number;
  /** Live-Kurs aus fetchEtoroRates, falls aufgelöst. */
  livePrice: number | undefined;
  /** Abstand zum Zielkurs in Prozent, bezogen auf den aktuellsten bekannten Kurs (livePrice bevorzugt). */
  distancePercent: number;
}

/**
 * Bildet die Kursalarme ab und berechnet den Abstand zum Zielkurs bezogen auf
 * den aktuellsten bekannten Kurs (Live-Kurs bevorzugt, sonst der im Alarm
 * gespeicherte currentPrice-Snapshot).
 */
export function selectPriceAlerts(
  response: EtoroPriceAlertsResponse | undefined,
  rates: Map<number, number>,
): PriceAlertView[] {
  const alerts = response?.results ?? [];

  return alerts.map((alert) => {
    const livePrice = rates.get(alert.instrumentId);
    const referencePrice = livePrice ?? alert.currentPrice;
    const distancePercent = referencePrice > 0 ? ((alert.targetPrice - referencePrice) / referencePrice) * 100 : 0;

    return {
      alertId: alert.alertId,
      instrumentId: alert.instrumentId,
      symbol: alert.symbol,
      targetPrice: alert.targetPrice,
      currentPrice: alert.currentPrice,
      livePrice,
      distancePercent,
    };
  });
}
