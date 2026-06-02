import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = (origin: string | null): HeadersInit => {
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };

  if (!origin) {
    // Non-browser clients; if configured, provide a deterministic value.
    if (allowed.length > 0) headers["Access-Control-Allow-Origin"] = allowed[0];
    return headers;
  }

  if (allowed.length > 0 && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
};

function log(message: string, data?: unknown) {
  if (data === undefined) {
    console.log(`[market-quotes] ${message}`);
  } else {
    console.log(`[market-quotes] ${message}`, data);
  }
}

function logError(message: string, data?: unknown) {
  if (data === undefined) {
    console.error(`[market-quotes] ${message}`);
  } else {
    console.error(`[market-quotes] ${message}`, data);
  }
}

type Provider = "yahoo" | "stooq";

type QuoteData = {
  symbol: string;
  name?: string;
  price: number;
  change?: number;
  change_percent?: number;
  currency?: string;
  exchange?: string;
  timestamp?: number;
  provider: Provider;
};

function normalizeSymbols(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((s) => (typeof s === "string" ? s.trim().toUpperCase() : ""))
    .filter((s) => s.length > 0)
    .slice(0, 100);
}

async function fetchYahooQuotes(symbols: string[]): Promise<QuoteData[]> {
  if (symbols.length === 0) return [];

  const url = new URL("https://query1.finance.yahoo.com/v7/finance/quote");
  url.searchParams.set("symbols", symbols.join(","));
  url.searchParams.set("lang", "en-US");
  url.searchParams.set("region", "US");

  log("Fetching Yahoo quotes", { symbolsCount: symbols.length });

  const resp = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; Dyad/1.0)",
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Yahoo error ${resp.status}: ${text.slice(0, 300)}`);
  }

  const json = await resp.json();
  const results: any[] = json?.quoteResponse?.result ?? [];

  const quotes: QuoteData[] = [];
  for (const r of results) {
    const price = r?.regularMarketPrice;
    const symbol = r?.symbol;
    if (typeof symbol !== "string" || typeof price !== "number") continue;

    const prevClose = r?.regularMarketPreviousClose;
    const change = typeof r?.regularMarketChange === "number" ? r.regularMarketChange : undefined;
    const changePercent = typeof r?.regularMarketChangePercent === "number" ? r.regularMarketChangePercent : undefined;

    quotes.push({
      symbol: symbol.toUpperCase(),
      name: typeof r?.longName === "string" ? r.longName : typeof r?.shortName === "string" ? r.shortName : undefined,
      price,
      change: change ?? (typeof prevClose === "number" ? price - prevClose : undefined),
      change_percent: changePercent,
      currency: typeof r?.currency === "string" ? r.currency : undefined,
      exchange: typeof r?.fullExchangeName === "string" ? r.fullExchangeName : typeof r?.exchange === "string" ? r.exchange : undefined,
      timestamp: typeof r?.regularMarketTime === "number" ? r.regularMarketTime * 1000 : undefined,
      provider: "yahoo",
    });
  }

  return quotes;
}

function toStooqSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper.includes(".")) return upper;
  return `${upper}.US`;
}

async function fetchStooqQuotes(symbols: string[]): Promise<QuoteData[]> {
  if (symbols.length === 0) return [];

  const quotes: QuoteData[] = [];

  for (const symbol of symbols) {
    const stooqSymbol = toStooqSymbol(symbol);
    const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol.toLowerCase())}&f=sd2t2ohlcv&h&e=csv`;

    const resp = await fetch(url, { headers: { "Accept": "text/csv" } });
    if (!resp.ok) continue;

    const csvText = await resp.text();
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) continue;

    const values = lines[1].split(",");
    if (values.length < 7) continue;

    const close = parseFloat(values[6]);
    if (Number.isNaN(close)) continue;

    const date = values[1];
    const time = values[2];
    const ts = Date.parse(`${date}T${time}Z`);

    quotes.push({
      symbol: symbol.toUpperCase(),
      price: close,
      currency: "USD",
      exchange: stooqSymbol.split(".")[1] || "US",
      timestamp: Number.isNaN(ts) ? undefined : ts,
      provider: "stooq",
    });
  }

  return quotes;
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers });
  }

  const token = authHeader.replace("Bearer ", "");

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );

  const {
    data: { user },
    error: userError,
  } = await supabaseClient.auth.getUser();

  if (userError || !user) {
    logError("Auth error", userError);
    return new Response("Invalid token", { status: 401, headers });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const symbols = normalizeSymbols(body?.symbols);
  const provider = (body?.provider === "stooq" ? "stooq" : "yahoo") as Provider;

  if (symbols.length === 0) {
    return new Response(JSON.stringify({ quotes: [] }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    let quotes: QuoteData[] = [];

    if (provider === "yahoo") {
      try {
        quotes = await fetchYahooQuotes(symbols);
      } catch (e) {
        logError("Yahoo failed, falling back to Stooq", { error: String(e) });
        quotes = await fetchStooqQuotes(symbols);
      }
    } else {
      quotes = await fetchStooqQuotes(symbols);
    }

    return new Response(JSON.stringify({ quotes }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e) {
    logError("Failed to fetch quotes", { error: String(e) });
    return new Response(JSON.stringify({ error: "quotes_failed" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});