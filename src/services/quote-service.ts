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