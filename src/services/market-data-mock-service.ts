"use client";

import type { QuoteData, ProviderType, MarketDataProvider } from '../types';

// -----------------------------------------------------------------------------
// Mock Data Service for Testing (when APIs are blocked by CORS)
// -----------------------------------------------------------------------------

/**
 * Mock prices for common German/US stocks
 * This is a temporary solution for testing the UI when APIs are blocked
 */
export const MOCK_PRICES: Record<string, { price: number; currency: string }> = {

};

/**
 * Add some random variation to mock prices for realism
 */
function getRandomPrice(basePrice: number): number {
  const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
  return basePrice * (1 + variation);
}

/**
 * Mock Market Data Provider (for testing when real APIs fail)
 */
export class MockMarketDataProvider implements MarketDataProvider {
  name = 'Mock Data (Testing)';
  type: ProviderType = 'yahoo';

  async fetchQuotes(symbols: string[]): Promise<QuoteData[]> {
    const quotes: QuoteData[] = [];
    
    for (const symbol of symbols) {
      const upperSymbol = symbol.toUpperCase();
      const basePriceInfo = MOCK_PRICES[upperSymbol];
      
      if (basePriceInfo) {
        // Add slight random variation
        const price = getRandomPrice(basePriceInfo.price);
        
        quotes.push({
          symbol: upperSymbol,
          name: `Mock Data: ${upperSymbol}`,
          price: price,
          currency: basePriceInfo.currency,
          provider: 'yahoo',
          timestamp: Date.now(),
        });
      } else {
        // Generate a random price for unknown symbols
        const randomPrice = 50 + Math.random() * 1000;
        quotes.push({
          symbol: upperSymbol,
          name: `Mock Data: ${upperSymbol}`,
          price: randomPrice,
          currency: 'USD',
          provider: 'yahoo',
          timestamp: Date.now(),
        });
      }
    }
    
    console.log('[MockMarketDataProvider] Generated mock quotes for:', symbols);
    return quotes;
  }

  async fetchQuote(symbol: string): Promise<QuoteData | null> {
    try {
      const quotes = await this.fetchQuotes([symbol]);
      return quotes.length > 0 ? quotes[0] : null;
    } catch (error) {
      console.error('[MockMarketDataProvider] Failed to fetch quote:', error);
      return null;
    }
  }
}