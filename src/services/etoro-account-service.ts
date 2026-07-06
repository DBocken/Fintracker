import type { Portfolio } from '../types';
import { t } from '../i18n/serviceT';
import { callEtoroProxy, getEtoroCredentials } from './etoro-service';
import {
  EtoroAggregatePortfolioResponseSchema,
  type EtoroAggregatePortfolioResponse,
  EtoroTradeHistoryResponseSchema,
  type EtoroTradeHistoryResponse,
  EtoroPnlResponseSchema,
  type EtoroPnlResponse,
  EtoroBalancesResponseSchema,
  type EtoroBalancesResponse,
  EtoroHistoricalBalancesResponseSchema,
  type EtoroHistoricalBalancesResponse,
  EtoroCashAccountTransactionsResponseSchema,
  type EtoroCashAccountTransactionsResponse,
  EtoroWatchlistsResponseSchema,
  type EtoroWatchlistsResponse,
  EtoroPriceAlertsResponseSchema,
  type EtoroPriceAlertsResponse,
  EtoroDiscussionsResponseSchema,
  type EtoroDiscussionsResponse,
  EtoroInstrumentSearchResponseSchema,
  type EtoroInstrumentSearchResponse,
  EtoroCuratedListsResponseSchema,
  type EtoroCuratedListsResponse,
  EtoroCandlesResponseSchema,
  type EtoroCandlesResponse,
  EtoroPublicUserInfoResponseSchema,
  type EtoroPublicUserInfoResponse,
} from './etoro-api-schemas';

// -----------------------------------------------------------------------------
// eToro-Account-Service: Live-Abfragen jenseits des Positions-Syncs (Cash,
// Konto-Totals, Smart Portfolios, Handelshistorie, Konto-P&L, ...). Anders als
// Positionen werden diese Daten NICHT lokal persistiert — sie sind reine
// Live-Views (react-query im Client cached sie), da sie dem Nutzer nicht
// "gehören" wie erfasste Positionen.
//
// etoro-service.ts bleibt Sync-/Persistenz-fokussiert; hier liegen die
// lesenden Konto-Ansichten. Credentials-Guard und Proxy-Aufruf werden von dort
// wiederverwendet (getEtoroCredentials / callEtoroProxy).
// -----------------------------------------------------------------------------

/**
 * Fehler einer eToro-Live-Abfrage. `isAuthError` markiert 401/403 vom Upstream
 * — daran erkennt der Client (EtoroScopeGate), dass dem Key evtl. ein Scope
 * fehlt, und zeigt einen entsprechenden Hinweis statt eines generischen Fehlers.
 */
export class EtoroAccountError extends Error {
  readonly isAuthError: boolean;
  constructor(message: string, isAuthError: boolean) {
    super(message);
    this.name = 'EtoroAccountError';
    this.isAuthError = isAuthError;
  }
}

// supabase.functions.invoke bildet Upstream-401/403 auf einen FunctionsHttpError
// ab, dessen Statuscode in error.context.status steckt. Wir lesen ihn defensiv
// aus, um Auth-/Scope-Fehler von echten Transportfehlern zu unterscheiden.
function isAuthStatus(error: { message?: string; context?: unknown } | null): boolean {
  if (!error) return false;
  const status = (error.context as { status?: number } | undefined)?.status;
  return status === 401 || status === 403;
}

interface ZodLikeSchema<T> {
  safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: { issues: unknown } };
}

/**
 * Gemeinsame Aufruf-/Validierungslogik aller eToro-Live-Abfragen: Proxy
 * rufen, Transport- und Body-Fehler in EtoroAccountError übersetzen (mit
 * korrektem isAuthError bei 401/403), Antwort gegen das übergebene Zod-Schema
 * prüfen. `label` dient nur der Log-Zuordnung bei unerwartetem Schema.
 */
async function fetchEtoroAccountEndpoint<T>(
  apiKey: string,
  userKey: string,
  extra: Record<string, unknown>,
  schema: ZodLikeSchema<T>,
  label: string,
): Promise<T> {
  const { data, error } = await callEtoroProxy(apiKey, userKey, extra);

  if (error) {
    throw new EtoroAccountError(
      t('etoroService.proxyError').replace('{error}', error.message || String(error)),
      isAuthStatus(error),
    );
  }
  const bodyError = data && typeof data === 'object' ? (data as Record<string, unknown>).error : undefined;
  if (bodyError) {
    const upstream = (data as Record<string, unknown>).upstream_status;
    throw new EtoroAccountError(
      t('etoroService.proxyError').replace('{error}', String(bodyError)),
      upstream === 401 || upstream === 403,
    );
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    console.error(`[etoro-account-service] Unerwartetes Antwort-Schema (${label}).`, {
      issues: parsed.error.issues,
      received: data,
    });
    throw new EtoroAccountError(t('etoroService.unexpectedResponse'), false);
  }

  return parsed.data;
}

/**
 * Holt den aggregierten Konto-Snapshot (/trading/info/aggregate-portfolio):
 * Cash, Konto-Totals, pro-Instrument-Aggregate und Smart Portfolios (mirrors).
 * Wirft EtoroAccountError; bei 401/403 mit isAuthError=true (fehlender Scope).
 */
export async function fetchEtoroAggregatePortfolio(
  apiKey: string,
  userKey: string,
): Promise<EtoroAggregatePortfolioResponse> {
  return fetchEtoroAccountEndpoint(
    apiKey,
    userKey,
    { endpoint: 'aggregate-portfolio' },
    EtoroAggregatePortfolioResponseSchema,
    'aggregate-portfolio',
  );
}

/**
 * Convenience-Wrapper: liest die Credentials des Portfolios (mit
 * Verschlüsselungs-Guard) und holt den Konto-Snapshot. Für den direkten
 * Aufruf aus react-query-Fetchern im Client.
 */
export async function fetchEtoroAggregateForPortfolio(
  portfolio: Portfolio | null,
): Promise<EtoroAggregatePortfolioResponse> {
  const { apiKey, userKey } = getEtoroCredentials(portfolio);
  return fetchEtoroAggregatePortfolio(apiKey, userKey);
}

export interface EtoroTradeHistoryOptions {
  /** ISO-Datum (YYYY-MM-DD); Default: '2000-01-01' (komplette Kontohistorie). */
  minDate?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Holt geschlossene Trades (/trading/info/trade/history). MVP: eine Seite
 * (Default pageSize 200 Trades) ohne Nachlade-Paginierung — für die
 * überwiegende Mehrheit der Konten ausreichend; `page`/`pageSize` sind bereits
 * durchgereicht, eine spätere "Mehr laden"-UI ist damit trivial nachrüstbar.
 * Wirft EtoroAccountError; bei 401/403 mit isAuthError=true (fehlender Scope).
 */
export async function fetchEtoroTradeHistory(
  apiKey: string,
  userKey: string,
  options: EtoroTradeHistoryOptions = {},
): Promise<EtoroTradeHistoryResponse> {
  const { minDate = '2000-01-01', page, pageSize = 200 } = options;
  return fetchEtoroAccountEndpoint(
    apiKey,
    userKey,
    { endpoint: 'trade-history', minDate, page, pageSize },
    EtoroTradeHistoryResponseSchema,
    'trade-history',
  );
}

/** Convenience-Wrapper analog fetchEtoroAggregateForPortfolio. */
export async function fetchEtoroTradeHistoryForPortfolio(
  portfolio: Portfolio | null,
  options?: EtoroTradeHistoryOptions,
): Promise<EtoroTradeHistoryResponse> {
  const { apiKey, userKey } = getEtoroCredentials(portfolio);
  return fetchEtoroTradeHistory(apiKey, userKey, options);
}

/**
 * Holt das Konto-P&L (/trading/info/real/pnl): Guthaben, Bonus-Guthaben,
 * unrealisierte Gesamt-G/V sowie je Mirror die realisierte G/V geschlossener
 * Positionen (closedPositionsNetProfit) — nicht in aggregate-portfolio
 * enthalten. Wirft EtoroAccountError; bei 401/403 mit isAuthError=true.
 */
export async function fetchEtoroPnl(apiKey: string, userKey: string): Promise<EtoroPnlResponse> {
  return fetchEtoroAccountEndpoint(apiKey, userKey, { endpoint: 'pnl' }, EtoroPnlResponseSchema, 'pnl');
}

/** Convenience-Wrapper analog fetchEtoroAggregateForPortfolio. */
export async function fetchEtoroPnlForPortfolio(portfolio: Portfolio | null): Promise<EtoroPnlResponse> {
  const { apiKey, userKey } = getEtoroCredentials(portfolio);
  return fetchEtoroPnl(apiKey, userKey);
}

/**
 * Holt die aggregierten Kontostände über alle eToro-Produkte (/balances):
 * u. a. die Cash-Account-ID, die fetchEtoroCashTransactions als Pfad-Parameter
 * benötigt. Wirft EtoroAccountError; bei 401/403 mit isAuthError=true
 * (Scope etoro-public:money.balance:read fehlt evtl. im Key).
 */
export async function fetchEtoroBalances(apiKey: string, userKey: string): Promise<EtoroBalancesResponse> {
  return fetchEtoroAccountEndpoint(apiKey, userKey, { endpoint: 'balances' }, EtoroBalancesResponseSchema, 'balances');
}

/** Convenience-Wrapper analog fetchEtoroAggregateForPortfolio. */
export async function fetchEtoroBalancesForPortfolio(portfolio: Portfolio | null): Promise<EtoroBalancesResponse> {
  const { apiKey, userKey } = getEtoroCredentials(portfolio);
  return fetchEtoroBalances(apiKey, userKey);
}

export interface EtoroBalancesHistoryOptions {
  /** ISO-Datum (YYYY-MM-DD); eToro-Default: toDate minus 30 Tage. */
  fromDate?: string;
  /** ISO-Datum (YYYY-MM-DD); eToro-Default: heute (UTC). */
  toDate?: string;
}

/**
 * Holt tägliche Kontostand-Snapshots (/balances/history) — Grundlage des
 * echten Performance-Charts (ersetzt den bisherigen Mock). Wirft
 * EtoroAccountError; bei 401/403 mit isAuthError=true.
 */
export async function fetchEtoroBalancesHistory(
  apiKey: string,
  userKey: string,
  options: EtoroBalancesHistoryOptions = {},
): Promise<EtoroHistoricalBalancesResponse> {
  return fetchEtoroAccountEndpoint(
    apiKey,
    userKey,
    { endpoint: 'balances-history', ...options },
    EtoroHistoricalBalancesResponseSchema,
    'balances-history',
  );
}

/** Convenience-Wrapper analog fetchEtoroAggregateForPortfolio. */
export async function fetchEtoroBalancesHistoryForPortfolio(
  portfolio: Portfolio | null,
  options?: EtoroBalancesHistoryOptions,
): Promise<EtoroHistoricalBalancesResponse> {
  const { apiKey, userKey } = getEtoroCredentials(portfolio);
  return fetchEtoroBalancesHistory(apiKey, userKey, options);
}

export interface EtoroCashTransactionsOptions {
  pageSize?: number;
  pageToken?: string;
}

/**
 * Holt Cash-Konto-Bewegungen (/money/accounts/cash/{accountId}/transactions):
 * Gebühren, Transfers, Kartenzahlungen, Guthaben-Anpassungen — Grundlage des
 * „Cash-Bewegungen"-Segments im Historie-Tab. `accountId` muss zuvor über
 * fetchEtoroBalances aufgelöst werden (selectCashAccountId). Wirft
 * EtoroAccountError; bei 401/403 mit isAuthError=true (Scope
 * etoro-public:money.cash-transactions:read fehlt evtl. im Key).
 */
export async function fetchEtoroCashTransactions(
  apiKey: string,
  userKey: string,
  accountId: string,
  options: EtoroCashTransactionsOptions = {},
): Promise<EtoroCashAccountTransactionsResponse> {
  return fetchEtoroAccountEndpoint(
    apiKey,
    userKey,
    { endpoint: 'cash-transactions', accountId, ...options },
    EtoroCashAccountTransactionsResponseSchema,
    'cash-transactions',
  );
}

/** Convenience-Wrapper analog fetchEtoroAggregateForPortfolio. */
export async function fetchEtoroCashTransactionsForPortfolio(
  portfolio: Portfolio | null,
  accountId: string,
  options?: EtoroCashTransactionsOptions,
): Promise<EtoroCashAccountTransactionsResponse> {
  const { apiKey, userKey } = getEtoroCredentials(portfolio);
  return fetchEtoroCashTransactions(apiKey, userKey, accountId, options);
}

/**
 * Holt alle Watchlists inkl. Items (/watchlists, bis itemsPerPageForSingle,
 * eToro-Default 100 je Watchlist). Wirft EtoroAccountError; bei 401/403 mit
 * isAuthError=true (Scope etoro-public:watchlist:read fehlt evtl. im Key).
 */
export async function fetchEtoroWatchlists(apiKey: string, userKey: string): Promise<EtoroWatchlistsResponse> {
  return fetchEtoroAccountEndpoint(
    apiKey,
    userKey,
    { endpoint: 'watchlists' },
    EtoroWatchlistsResponseSchema,
    'watchlists',
  );
}

/** Convenience-Wrapper analog fetchEtoroAggregateForPortfolio. */
export async function fetchEtoroWatchlistsForPortfolio(portfolio: Portfolio | null): Promise<EtoroWatchlistsResponse> {
  const { apiKey, userKey } = getEtoroCredentials(portfolio);
  return fetchEtoroWatchlists(apiKey, userKey);
}

export interface EtoroWatchlistItemsOptions {
  pageNumber?: number;
  itemsPerPage?: number;
}

/**
 * Holt eine einzelne Watchlist mit voll paginierten Items
 * (/watchlists/{watchlistId}) — anders als fetchEtoroWatchlists, dessen Items
 * je Watchlist auf itemsPerPageForSingle begrenzt sind. Wirft
 * EtoroAccountError; bei 401/403 mit isAuthError=true.
 */
export async function fetchEtoroWatchlistItems(
  apiKey: string,
  userKey: string,
  watchlistId: string,
  options: EtoroWatchlistItemsOptions = {},
): Promise<EtoroWatchlistsResponse> {
  return fetchEtoroAccountEndpoint(
    apiKey,
    userKey,
    { endpoint: 'watchlist-items', watchlistId, ...options },
    EtoroWatchlistsResponseSchema,
    'watchlist-items',
  );
}

/** Convenience-Wrapper analog fetchEtoroAggregateForPortfolio. */
export async function fetchEtoroWatchlistItemsForPortfolio(
  portfolio: Portfolio | null,
  watchlistId: string,
  options?: EtoroWatchlistItemsOptions,
): Promise<EtoroWatchlistsResponse> {
  const { apiKey, userKey } = getEtoroCredentials(portfolio);
  return fetchEtoroWatchlistItems(apiKey, userKey, watchlistId, options);
}

/**
 * Holt aktive Kursalarme (/price-alerts). Wirft EtoroAccountError; bei
 * 401/403 mit isAuthError=true (Scope etoro-public:price-alerts:read fehlt
 * evtl. im Key).
 */
export async function fetchEtoroPriceAlerts(apiKey: string, userKey: string): Promise<EtoroPriceAlertsResponse> {
  return fetchEtoroAccountEndpoint(
    apiKey,
    userKey,
    { endpoint: 'price-alerts' },
    EtoroPriceAlertsResponseSchema,
    'price-alerts',
  );
}

/** Convenience-Wrapper analog fetchEtoroAggregateForPortfolio. */
export async function fetchEtoroPriceAlertsForPortfolio(portfolio: Portfolio | null): Promise<EtoroPriceAlertsResponse> {
  const { apiKey, userKey } = getEtoroCredentials(portfolio);
  return fetchEtoroPriceAlerts(apiKey, userKey);
}

export interface EtoroNewsFeedOptions {
  take?: number;
  offset?: number;
}

/**
 * Holt den allgemeinen News-Feed (/feeds/news, eToro-Ranking). Wirft
 * EtoroAccountError; bei 401/403 mit isAuthError=true (Scope
 * etoro-public:feed:read fehlt evtl. im Key).
 */
export async function fetchEtoroNewsFeed(
  apiKey: string,
  userKey: string,
  options: EtoroNewsFeedOptions = {},
): Promise<EtoroDiscussionsResponse> {
  return fetchEtoroAccountEndpoint(
    apiKey,
    userKey,
    { endpoint: 'feeds-news', ...options },
    EtoroDiscussionsResponseSchema,
    'feeds-news',
  );
}

/** Convenience-Wrapper analog fetchEtoroAggregateForPortfolio. */
export async function fetchEtoroNewsFeedForPortfolio(
  portfolio: Portfolio | null,
  options?: EtoroNewsFeedOptions,
): Promise<EtoroDiscussionsResponse> {
  const { apiKey, userKey } = getEtoroCredentials(portfolio);
  return fetchEtoroNewsFeed(apiKey, userKey, options);
}

export interface EtoroMarketFeedOptions {
  take?: number;
}

/**
 * Holt Feed-Beiträge zu einem bestimmten Instrument (/feeds/markets/{id}) —
 * Grundlage des "Meine Positionen"-Filters im News-Tab (ein Aufruf je
 * gehaltenem Instrument, siehe selectMergedMarketFeed). Wirft
 * EtoroAccountError; bei 401/403 mit isAuthError=true.
 */
export async function fetchEtoroMarketFeed(
  apiKey: string,
  userKey: string,
  marketId: string,
  options: EtoroMarketFeedOptions = {},
): Promise<EtoroDiscussionsResponse> {
  return fetchEtoroAccountEndpoint(
    apiKey,
    userKey,
    { endpoint: 'feeds-market', marketId, ...options },
    EtoroDiscussionsResponseSchema,
    'feeds-market',
  );
}

/** Convenience-Wrapper analog fetchEtoroAggregateForPortfolio. */
export async function fetchEtoroMarketFeedForPortfolio(
  portfolio: Portfolio | null,
  marketId: string,
  options?: EtoroMarketFeedOptions,
): Promise<EtoroDiscussionsResponse> {
  const { apiKey, userKey } = getEtoroCredentials(portfolio);
  return fetchEtoroMarketFeed(apiKey, userKey, marketId, options);
}

/**
 * Holt das Konto-P&L des Demo-Kontos (/trading/info/demo/pnl) — analog
 * fetchEtoroPnl, aber für das Übungskonto (Backlog-Extra "Demo-Konto").
 * Wirft EtoroAccountError; bei 401/403 mit isAuthError=true (Scope
 * etoro-public:demo:read fehlt evtl. im Key).
 */
export async function fetchEtoroDemoPnl(apiKey: string, userKey: string): Promise<EtoroPnlResponse> {
  return fetchEtoroAccountEndpoint(apiKey, userKey, { endpoint: 'demo-pnl' }, EtoroPnlResponseSchema, 'demo-pnl');
}

/** Convenience-Wrapper analog fetchEtoroAggregateForPortfolio. */
export async function fetchEtoroDemoPnlForPortfolio(portfolio: Portfolio | null): Promise<EtoroPnlResponse> {
  const { apiKey, userKey } = getEtoroCredentials(portfolio);
  return fetchEtoroDemoPnl(apiKey, userKey);
}

export interface EtoroInstrumentSearchOptions {
  pageSize?: number;
}

/**
 * Sucht Instrumente per Freitext (/market-data/search, Filter auf
 * `displayname`) — Backlog-Extra "Instrument-Suche". Wirft
 * EtoroAccountError; bei 401/403 mit isAuthError=true.
 */
export async function fetchEtoroInstrumentSearch(
  apiKey: string,
  userKey: string,
  query: string,
  options: EtoroInstrumentSearchOptions = {},
): Promise<EtoroInstrumentSearchResponse> {
  return fetchEtoroAccountEndpoint(
    apiKey,
    userKey,
    { endpoint: 'instrument-search', query, ...options },
    EtoroInstrumentSearchResponseSchema,
    'instrument-search',
  );
}

/** Convenience-Wrapper analog fetchEtoroAggregateForPortfolio. */
export async function fetchEtoroInstrumentSearchForPortfolio(
  portfolio: Portfolio | null,
  query: string,
  options?: EtoroInstrumentSearchOptions,
): Promise<EtoroInstrumentSearchResponse> {
  const { apiKey, userKey } = getEtoroCredentials(portfolio);
  return fetchEtoroInstrumentSearch(apiKey, userKey, query, options);
}

/**
 * Holt Empfehlungen/kuratierte Listen (/curated-lists) — Backlog-Extra
 * "Empfehlungen/kuratierte Listen". Wirft EtoroAccountError; bei 401/403 mit
 * isAuthError=true (Scope etoro-public:watchlist:read fehlt evtl. im Key).
 */
export async function fetchEtoroCuratedLists(apiKey: string, userKey: string): Promise<EtoroCuratedListsResponse> {
  return fetchEtoroAccountEndpoint(
    apiKey,
    userKey,
    { endpoint: 'curated-lists' },
    EtoroCuratedListsResponseSchema,
    'curated-lists',
  );
}

/** Convenience-Wrapper analog fetchEtoroAggregateForPortfolio. */
export async function fetchEtoroCuratedListsForPortfolio(portfolio: Portfolio | null): Promise<EtoroCuratedListsResponse> {
  const { apiKey, userKey } = getEtoroCredentials(portfolio);
  return fetchEtoroCuratedLists(apiKey, userKey);
}

export type EtoroCandleDirection = 'asc' | 'desc';
export type EtoroCandleInterval =
  | 'OneMinute'
  | 'FiveMinutes'
  | 'TenMinutes'
  | 'FifteenMinutes'
  | 'ThirtyMinutes'
  | 'OneHour'
  | 'FourHours'
  | 'OneDay'
  | 'OneWeek';

export interface EtoroInstrumentCandlesOptions {
  direction?: EtoroCandleDirection;
  interval?: EtoroCandleInterval;
  candlesCount?: number;
}

/**
 * Holt die Candle-Historie (OHLCV) eines Instruments
 * (/market-data/instruments/{id}/history/candles/...) — Backlog-Extra
 * "Candles-Chart je Instrument". Wirft EtoroAccountError; bei 401/403 mit
 * isAuthError=true.
 */
export async function fetchEtoroInstrumentCandles(
  apiKey: string,
  userKey: string,
  instrumentId: number,
  options: EtoroInstrumentCandlesOptions = {},
): Promise<EtoroCandlesResponse> {
  return fetchEtoroAccountEndpoint(
    apiKey,
    userKey,
    { endpoint: 'instrument-candles', instrumentId, ...options },
    EtoroCandlesResponseSchema,
    'instrument-candles',
  );
}

/** Convenience-Wrapper analog fetchEtoroAggregateForPortfolio. */
export async function fetchEtoroInstrumentCandlesForPortfolio(
  portfolio: Portfolio | null,
  instrumentId: number,
  options?: EtoroInstrumentCandlesOptions,
): Promise<EtoroCandlesResponse> {
  const { apiKey, userKey } = getEtoroCredentials(portfolio);
  return fetchEtoroInstrumentCandles(apiKey, userKey, instrumentId, options);
}

/**
 * Holt das öffentliche Profil eines Traders per Username
 * (/user-info/people?usernames=...) — Backlog-Extra "Öffentliche
 * Trader-Profile". Wirft EtoroAccountError; bei 401/403 mit
 * isAuthError=true (Scope etoro-public:user-info:read fehlt evtl. im Key).
 */
export async function fetchEtoroPublicUserInfo(
  apiKey: string,
  userKey: string,
  username: string,
): Promise<EtoroPublicUserInfoResponse> {
  return fetchEtoroAccountEndpoint(
    apiKey,
    userKey,
    { endpoint: 'user-info', username },
    EtoroPublicUserInfoResponseSchema,
    'user-info',
  );
}

/** Convenience-Wrapper analog fetchEtoroAggregateForPortfolio. */
export async function fetchEtoroPublicUserInfoForPortfolio(
  portfolio: Portfolio | null,
  username: string,
): Promise<EtoroPublicUserInfoResponse> {
  const { apiKey, userKey } = getEtoroCredentials(portfolio);
  return fetchEtoroPublicUserInfo(apiKey, userKey, username);
}
