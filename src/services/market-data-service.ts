"use client";

import type { QuoteData, ProviderType } from '@/types';
import { supabase } from '@/integrations/supabase/client';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

type CacheEntry = {
  quote: QuoteData;
  ts: number;
};

const memCache = new Map<string, CacheEntry>();

function nowMs() {
  return Date.now();
}

function normalizeSymbolKey(symbol: string): string {
  return symbol.toUpperCase().trim();
}

function cacheGet(symbol: string): QuoteData | null {
  const key = normalizeSymbolKey(symbol);
  const hit = memCache.get(key);
  if (!hit) return null;
  if (nowMs() - hit.ts > CACHE_TTL) {
    memCache.delete(key);
    return null;
  }
  return hit.quote;
}

function cacheSet(quotes: QuoteData[]) {
  const ts = nowMs();
  for (const q of quotes) {
    if (!q?.symbol) continue;
    memCache.set(normalizeSymbolKey(q.symbol), { quote: q, ts: q.timestamp ?? ts });
  }
}

/**
 * Fetch quotes via Supabase Edge Function.
 * Caching is in-memory only (no localStorage) to avoid persisting sensitive financial data client-side.
 */
export async function fetchQuotes(
  symbols: string[],
  provider: ProviderType = 'yahoo'
): Promise<QuoteData[]> {
  const uniqueSymbols = [...new Set(symbols.map(normalizeSymbolKey))].filter(Boolean);
  if (uniqueSymbols.length === 0) return [];

  const cachedResults: QuoteData[] = [];
  const freshNeeded: string[] = [];

  for (const s of uniqueSymbols) {
    const hit = cacheGet(s);
    if (hit) cachedResults.push({ ...hit, provider });
    else freshNeeded.push(s);
  }

  if (freshNeeded.length === 0) return cachedResults;

  const { data, error } = await supabase.functions.invoke('market-quotes', {
    body: {
      symbols: freshNeeded,
      provider: provider === 'stooq' ? 'stooq' : 'yahoo',
    },
  });

  if (error) throw new Error(error.message);

  const quotes: QuoteData[] = (data?.quotes || []) as QuoteData[];
  cacheSet(quotes.map((q) => ({ ...q, provider })));

  const merged = new Map<string, QuoteData>();
  for (const q of cachedResults) merged.set(normalizeSymbolKey(q.symbol), q);
  for (const q of quotes) merged.set(normalizeSymbolKey(q.symbol), { ...q, provider });

  return uniqueSymbols
    .map((s) => merged.get(s))
    .filter((q): q is QuoteData => !!q);
}

export async function fetchQuote(
  symbol: string,
  provider: ProviderType = 'yahoo'
): Promise<QuoteData | null> {
  const quotes = await fetchQuotes([symbol], provider);
  return quotes[0] ?? null;
}