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
