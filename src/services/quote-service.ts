import type { QuoteData, ProviderType } from '../types';
import { fetchQuotes as fetchQuotesMarketData } from './market-data-service';

// -----------------------------------------------------------------------------
// Symbol Normalization (kept for UI / storage)
// -----------------------------------------------------------------------------

export function normalizeSymbol(symbol: string, exchange?: string): string {
  const upperSymbol = symbol.toUpperCase().trim();

  if (exchange) {
    switch (exchange.toUpperCase()) {
      case 'XETRA':
      case 'FRA':
        return `${upperSymbol}.DE`;
      case 'LSE':
        return `${upperSymbol}.L`;
      case 'TSE':
        return `${upperSymbol}.TO`;
      case 'ASX':
        return `${upperSymbol}.AX`;
      default:
        return upperSymbol;
    }
  }

  return upperSymbol;
}

// eToro-Positionen tragen dieses Exchange-Kennzeichen (siehe etoro-service).
export const ETORO_EXCHANGE = 'ETORO';

/**
 * eToro-Symbole kollidieren mit US-Tickern (DASH = Krypto Dash bei eToro,
 * DoorDash bei Yahoo; A = VAULTA vs. Agilent). Solche Positionen dürfen
 * deshalb nie über Symbol-Matching Kurse von Yahoo/Stooq erhalten — ihre
 * Kurse kommen ausschließlich über die eToro-instrumentID.
 */
export function isEtoroPosition(position: { exchange?: string }): boolean {
  return position.exchange?.toUpperCase() === ETORO_EXCHANGE;
}

/**
 * Ordnet gelieferte Kurse den Positionen zu — über das börsennormalisierte
 * Symbol (XETRA → .DE usw.), nicht das rohe. Nur so finden europäische Kurse
 * ihre Position; ungültige Preise werden verworfen. eToro-Positionen sind
 * vom Symbol-Matching ausgeschlossen (Symbol-Kollisionen, s. isEtoroPosition).
 */
export function mapQuotesToPriceUpdates(
  positions: Array<{ id: string; symbol: string; exchange?: string }>,
  quotes: Array<Pick<QuoteData, 'symbol' | 'price'>>,
): Array<{ id: string; price: number }> {
  const priceBySymbol = new Map<string, number>();
  for (const quote of quotes) {
    if (typeof quote.price === 'number' && Number.isFinite(quote.price) && quote.price > 0) {
      priceBySymbol.set(quote.symbol.toUpperCase().trim(), quote.price);
    }
  }

  const updates: Array<{ id: string; price: number }> = [];
  for (const position of positions) {
    if (isEtoroPosition(position)) continue;
    const key = normalizeSymbol(position.symbol, position.exchange);
    const price = priceBySymbol.get(key);
    if (price !== undefined) updates.push({ id: position.id, price });
  }
  return updates;
}

// -----------------------------------------------------------------------------
// Public API (now backed by server-side Edge Function)
// -----------------------------------------------------------------------------

export async function fetchQuotesCached(
  symbols: string[],
  provider: ProviderType = 'yahoo'
): Promise<QuoteData[]> {
  return fetchQuotesMarketData(symbols, provider);
}

export async function fetchQuotesWithFallback(
  symbols: string[],
  preferredProvider: ProviderType = 'yahoo'
): Promise<QuoteData[]> {
  return fetchQuotesMarketData(symbols, preferredProvider);
}

export async function fetchQuote(
  symbol: string,
  provider: ProviderType = 'yahoo'
): Promise<QuoteData | null> {
  const quotes = await fetchQuotesMarketData([symbol], provider);
  return quotes[0] ?? null;
}

export function clearQuoteCache(): void {
  // In-memory cache is handled by market-data-service.
}

export function getCacheStats() {
  return {
    size: 'In-memory',
    ttl: 300000,
    minInterval: 0,
  };
}