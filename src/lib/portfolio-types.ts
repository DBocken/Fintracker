/**
 * Persistierte und abgeleitete Formen rund um Wertpapier-Portfolios und
 * Marktdaten-Anbieter.
 *
 * Domäne, nicht Speicherung — der `portfolio-service`/`etoro-service`
 * speichert `Portfolio`/`PortfolioPosition`, besitzt die Form aber nicht
 * (AGENTS.md §3). `MarketDataProvider`/`QuoteData` sind vom
 * `market-data-service`/`quote-service` **und** von `components/trading`
 * bzw. `features/trading` gebraucht — ebenfalls `src/lib/` nach der „Wohin
 * ein Typ gehört"-Tabelle. Diese Datei ist Teil der Aufteilung von
 * `src/types.ts` (WP 5.2, DOM-3).
 */

export type ProviderType = 'etoro' | 'yahoo' | 'stooq' | 'mock';

export interface MarketDataProvider {
  name: string;
  type: ProviderType;
  fetchQuotes(symbols: string[]): Promise<QuoteData[]>;
  fetchQuote(symbol: string): Promise<QuoteData | null>;
}

export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  type: 'etoro' | 'manual' | 'demo';
  provider_config?: Record<string, unknown>;
  currency: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PortfolioPosition {
  id: string;
  portfolio_id: string;
  symbol: string;
  name?: string;
  quantity: number;
  entry_price: number;
  currency: string;
  exchange?: string;
  metadata?: Record<string, unknown>;
  last_price?: number;
  last_price_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface QuoteData {
  symbol: string;
  name?: string;
  price: number;
  change?: number;
  change_percent?: number;
  currency?: string;
  exchange?: string;
  timestamp?: number;
  provider: ProviderType;
}

export interface PortfolioSummary {
  total_value: number;
  total_cost: number;
  unrealized_gain_loss: number;
  unrealized_gain_loss_percent: number;
  realized_gain_loss?: number;
  realized_gain_loss_percent?: number;
  positions_count: number;
  currency: string;
}
