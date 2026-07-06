import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  },
}));

import { supabase } from '@/integrations/supabase/client';
import { localEncryption } from '../local-crypto';
import {
  fetchEtoroAggregatePortfolio,
  fetchEtoroAggregateForPortfolio,
  fetchEtoroTradeHistory,
  fetchEtoroTradeHistoryForPortfolio,
  fetchEtoroPnl,
  fetchEtoroPnlForPortfolio,
  fetchEtoroBalances,
  fetchEtoroBalancesForPortfolio,
  fetchEtoroBalancesHistory,
  fetchEtoroBalancesHistoryForPortfolio,
  fetchEtoroCashTransactions,
  fetchEtoroCashTransactionsForPortfolio,
  fetchEtoroWatchlists,
  fetchEtoroWatchlistsForPortfolio,
  fetchEtoroWatchlistItems,
  fetchEtoroWatchlistItemsForPortfolio,
  fetchEtoroPriceAlerts,
  fetchEtoroPriceAlertsForPortfolio,
  EtoroAccountError,
} from '../etoro-account-service';
import {
  EtoroAggregatePortfolioResponseSchema,
  EtoroTradeHistoryResponseSchema,
  EtoroPnlResponseSchema,
  EtoroBalancesResponseSchema,
  EtoroHistoricalBalancesResponseSchema,
  EtoroCashAccountTransactionsResponseSchema,
  EtoroWatchlistsResponseSchema,
  EtoroPriceAlertsResponseSchema,
} from '../etoro-api-schemas';
import type { Portfolio } from '../../types';

const invokeMock = vi.mocked(supabase.functions.invoke);

// Fixture validiert sich selbst gegen das Schema — ein erfundenes Feld ließe
// den Test sofort scheitern (Issue-#195-Regel).
function aggregateResponse() {
  return EtoroAggregatePortfolioResponseSchema.parse({
    accountCurrency: 'USD',
    accountTotals: {
      accountAvailableCash: 4320.84,
      accountFrozenCash: 0,
      accountCurrentPnl: -300.35,
      accountTotalValue: 5154.48,
      accountTotalUsedMargin: 1133.99,
      accountBalance: 4320.84,
    },
    instrumentAggregates: [{ instrumentId: 1001, accountCurrencyReturn: -10 }],
    mirrors: [{ mirrorId: 42, mirrorTotals: { mirrorLiquidationValue: 209.08 } }],
  });
}

function etoroPortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'pf-1',
    user_id: 'local',
    name: 'eToro',
    type: 'etoro',
    provider_config: { apiKey: 'k1', userKey: 'k2' },
    currency: 'USD',
    is_active: true,
    ...overrides,
  } as Portfolio;
}

describe('fetchEtoroAggregatePortfolio', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
  });

  it('sollte den aggregate-portfolio-Endpoint über den Proxy aufrufen und validierte Daten liefern', async () => {
    invokeMock.mockResolvedValue({ data: aggregateResponse(), error: null } as never);

    const result = await fetchEtoroAggregatePortfolio('k1', 'k2');

    expect(invokeMock).toHaveBeenCalledWith('etoro-proxy', {
      body: { endpoint: 'aggregate-portfolio', apiKey: 'k1', userKey: 'k2' },
    });
    expect(result.accountTotals?.accountAvailableCash).toBe(4320.84);
    expect(result.mirrors).toHaveLength(1);
  });

  it('sollte bei Transport-Fehler einen EtoroAccountError werfen', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: 'boom' } } as never);
    await expect(fetchEtoroAggregatePortfolio('k1', 'k2')).rejects.toBeInstanceOf(EtoroAccountError);
  });

  it('[REGRESSION] sollte 401/403 als isAuthError markieren (fehlender Scope, nicht generischer Fehler)', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: 'unauthorized', context: { status: 403 } },
    } as never);

    await expect(fetchEtoroAggregatePortfolio('k1', 'k2')).rejects.toMatchObject({ isAuthError: true });
  });

  it('sollte einen Body-Fehler mit upstream_status 401 als isAuthError markieren', async () => {
    invokeMock.mockResolvedValue({
      data: { error: 'etoro_request_failed', upstream_status: 401 },
      error: null,
    } as never);

    await expect(fetchEtoroAggregatePortfolio('k1', 'k2')).rejects.toMatchObject({ isAuthError: true });
  });

  it('[REGRESSION] sollte bei unerwartetem Antwort-Schema werfen statt still Müll zu liefern', async () => {
    invokeMock.mockResolvedValue({ data: { accountTotals: { accountAvailableCash: 'viel' } }, error: null } as never);
    await expect(fetchEtoroAggregatePortfolio('k1', 'k2')).rejects.toBeInstanceOf(EtoroAccountError);
  });
});

describe('fetchEtoroAggregateForPortfolio (mit Credentials-Guard)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
    localEncryption.lock();
  });

  it('[SECURITY] sollte bei gesperrter Verschlüsselung werfen, ohne den Proxy zu rufen', async () => {
    await expect(fetchEtoroAggregateForPortfolio(etoroPortfolio())).rejects.toThrow(/Verschlüsselung/i);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('sollte bei Nicht-eToro-Portfolio werfen', async () => {
    await localEncryption.enable('test-passwort-123');
    await expect(fetchEtoroAggregateForPortfolio(etoroPortfolio({ type: 'manual' }))).rejects.toThrow();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('sollte nach Entsperren die Credentials des Portfolios verwenden', async () => {
    await localEncryption.enable('test-passwort-123');
    invokeMock.mockResolvedValue({ data: aggregateResponse(), error: null } as never);

    await fetchEtoroAggregateForPortfolio(etoroPortfolio());

    expect(invokeMock).toHaveBeenCalledWith('etoro-proxy', {
      body: { endpoint: 'aggregate-portfolio', apiKey: 'k1', userKey: 'k2' },
    });
  });
});

// Fixture validiert sich selbst gegen das Schema (Issue-#195-Regel).
function tradeHistoryResponse() {
  return EtoroTradeHistoryResponseSchema.parse([
    {
      positionId: 987654321,
      instrumentId: 1001,
      netProfit: 42.5,
      closeTimestamp: '2026-06-01T10:00:00Z',
      openTimestamp: '2026-05-01T09:00:00Z',
      isBuy: true,
    },
  ]);
}

function pnlResponse() {
  return EtoroPnlResponseSchema.parse({
    clientPortfolio: {
      credit: 10000.5,
      bonusCredit: 500,
      unrealizedPnL: 251,
      mirrors: [{ mirrorID: 1, closedPositionsNetProfit: 350.75, parentUsername: 'parent_user' }],
    },
  });
}

describe('fetchEtoroTradeHistory', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
  });

  it('sollte den trade-history-Endpoint mit Default-minDate/pageSize aufrufen und validierte Daten liefern', async () => {
    invokeMock.mockResolvedValue({ data: tradeHistoryResponse(), error: null } as never);

    const result = await fetchEtoroTradeHistory('k1', 'k2');

    expect(invokeMock).toHaveBeenCalledWith('etoro-proxy', {
      body: { endpoint: 'trade-history', apiKey: 'k1', userKey: 'k2', minDate: '2000-01-01', page: undefined, pageSize: 200 },
    });
    expect(result).toHaveLength(1);
    expect(result[0].netProfit).toBe(42.5);
  });

  it('sollte übergebene minDate/page/pageSize durchreichen', async () => {
    invokeMock.mockResolvedValue({ data: [], error: null } as never);

    await fetchEtoroTradeHistory('k1', 'k2', { minDate: '2026-01-01', page: 2, pageSize: 50 });

    expect(invokeMock).toHaveBeenCalledWith('etoro-proxy', {
      body: { endpoint: 'trade-history', apiKey: 'k1', userKey: 'k2', minDate: '2026-01-01', page: 2, pageSize: 50 },
    });
  });

  it('sollte ein leeres Array akzeptieren (keine geschlossenen Trades)', async () => {
    invokeMock.mockResolvedValue({ data: [], error: null } as never);
    await expect(fetchEtoroTradeHistory('k1', 'k2')).resolves.toEqual([]);
  });

  it('[REGRESSION] sollte 401/403 als isAuthError markieren (fehlender Scope)', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: 'unauthorized', context: { status: 401 } },
    } as never);

    await expect(fetchEtoroTradeHistory('k1', 'k2')).rejects.toMatchObject({ isAuthError: true });
  });

  it('[REGRESSION] sollte bei unerwartetem Antwort-Schema werfen statt still Müll zu liefern', async () => {
    invokeMock.mockResolvedValue({ data: { trades: [] }, error: null } as never);
    await expect(fetchEtoroTradeHistory('k1', 'k2')).rejects.toBeInstanceOf(EtoroAccountError);
  });
});

describe('fetchEtoroTradeHistoryForPortfolio (mit Credentials-Guard)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
    localEncryption.lock();
  });

  it('[SECURITY] sollte bei gesperrter Verschlüsselung werfen, ohne den Proxy zu rufen', async () => {
    await expect(fetchEtoroTradeHistoryForPortfolio(etoroPortfolio())).rejects.toThrow(/Verschlüsselung/i);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('sollte nach Entsperren die Credentials des Portfolios verwenden', async () => {
    await localEncryption.enable('test-passwort-123');
    invokeMock.mockResolvedValue({ data: tradeHistoryResponse(), error: null } as never);

    await fetchEtoroTradeHistoryForPortfolio(etoroPortfolio());

    expect(invokeMock).toHaveBeenCalledWith('etoro-proxy', {
      body: { endpoint: 'trade-history', apiKey: 'k1', userKey: 'k2', minDate: '2000-01-01', page: undefined, pageSize: 200 },
    });
  });
});

describe('fetchEtoroPnl', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
  });

  it('sollte den pnl-Endpoint über den Proxy aufrufen und validierte Daten liefern', async () => {
    invokeMock.mockResolvedValue({ data: pnlResponse(), error: null } as never);

    const result = await fetchEtoroPnl('k1', 'k2');

    expect(invokeMock).toHaveBeenCalledWith('etoro-proxy', {
      body: { endpoint: 'pnl', apiKey: 'k1', userKey: 'k2' },
    });
    expect(result.clientPortfolio?.unrealizedPnL).toBe(251);
    expect(result.clientPortfolio?.mirrors?.[0].closedPositionsNetProfit).toBe(350.75);
  });

  it('[REGRESSION] sollte 401/403 als isAuthError markieren (fehlender Scope)', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: 'unauthorized', context: { status: 403 } },
    } as never);

    await expect(fetchEtoroPnl('k1', 'k2')).rejects.toMatchObject({ isAuthError: true });
  });

  it('[REGRESSION] sollte bei unerwartetem Antwort-Schema werfen statt still Müll zu liefern', async () => {
    invokeMock.mockResolvedValue({ data: { clientPortfolio: { mirrors: [{ closedPositionsNetProfit: 5 }] } }, error: null } as never);
    await expect(fetchEtoroPnl('k1', 'k2')).rejects.toBeInstanceOf(EtoroAccountError);
  });
});

describe('fetchEtoroPnlForPortfolio (mit Credentials-Guard)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
    localEncryption.lock();
  });

  it('[SECURITY] sollte bei gesperrter Verschlüsselung werfen, ohne den Proxy zu rufen', async () => {
    await expect(fetchEtoroPnlForPortfolio(etoroPortfolio())).rejects.toThrow(/Verschlüsselung/i);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('sollte nach Entsperren die Credentials des Portfolios verwenden', async () => {
    await localEncryption.enable('test-passwort-123');
    invokeMock.mockResolvedValue({ data: pnlResponse(), error: null } as never);

    await fetchEtoroPnlForPortfolio(etoroPortfolio());

    expect(invokeMock).toHaveBeenCalledWith('etoro-proxy', {
      body: { endpoint: 'pnl', apiKey: 'k1', userKey: 'k2' },
    });
  });
});

// Fixture validiert sich selbst gegen das Schema (Issue-#195-Regel).
function balancesResponse() {
  return EtoroBalancesResponseSchema.parse({
    totalBalance: 5654.48,
    displayCurrency: 'USD',
    balances: [
      { accountId: 'cash-acc-1', accountType: 'Cash', balance: 500, displayBalance: 500 },
      { accountId: 'trading-acc-1', accountType: 'Trading', balance: 5154.48, displayBalance: 5154.48 },
    ],
  });
}

function balancesHistoryResponse() {
  return EtoroHistoricalBalancesResponseSchema.parse({
    displayCurrency: 'USD',
    snapshots: [
      { date: '2026-06-01', totalBalance: 5000, displayTotalBalance: 5000 },
      { date: '2026-06-02', totalBalance: 5100, displayTotalBalance: 5100 },
    ],
  });
}

function cashTransactionsResponse() {
  return EtoroCashAccountTransactionsResponseSchema.parse({
    results: [
      {
        id: '1',
        accountId: 'cash-acc-1',
        transactionType: 'balanceAdjustment',
        transactionSubtype: 'fee',
        direction: 'debit',
        status: 'settled',
        amount: '2.50',
        currency: 'USD',
        postedAt: '2026-06-01T00:00:00Z',
      },
    ],
    pagination: { pageSize: 50, hasNext: false },
  });
}

describe('fetchEtoroBalances', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
  });

  it('sollte den balances-Endpoint über den Proxy aufrufen und validierte Daten liefern', async () => {
    invokeMock.mockResolvedValue({ data: balancesResponse(), error: null } as never);

    const result = await fetchEtoroBalances('k1', 'k2');

    expect(invokeMock).toHaveBeenCalledWith('etoro-proxy', {
      body: { endpoint: 'balances', apiKey: 'k1', userKey: 'k2' },
    });
    expect(result.balances).toHaveLength(2);
  });

  it('[REGRESSION] sollte 401/403 als isAuthError markieren (fehlender money.balance:read-Scope)', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: 'unauthorized', context: { status: 403 } },
    } as never);
    await expect(fetchEtoroBalances('k1', 'k2')).rejects.toMatchObject({ isAuthError: true });
  });

  it('[REGRESSION] sollte bei unerwartetem Antwort-Schema werfen statt still Müll zu liefern', async () => {
    invokeMock.mockResolvedValue({ data: { balances: [{ accountId: 'x' }] }, error: null } as never);
    await expect(fetchEtoroBalances('k1', 'k2')).rejects.toBeInstanceOf(EtoroAccountError);
  });
});

describe('fetchEtoroBalancesForPortfolio (mit Credentials-Guard)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
    localEncryption.lock();
  });

  it('[SECURITY] sollte bei gesperrter Verschlüsselung werfen, ohne den Proxy zu rufen', async () => {
    await expect(fetchEtoroBalancesForPortfolio(etoroPortfolio())).rejects.toThrow(/Verschlüsselung/i);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

describe('fetchEtoroBalancesHistory', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
  });

  it('sollte den balances-history-Endpoint ohne Datumsfilter aufrufen (eToro-Default: letzte 30 Tage)', async () => {
    invokeMock.mockResolvedValue({ data: balancesHistoryResponse(), error: null } as never);

    const result = await fetchEtoroBalancesHistory('k1', 'k2');

    expect(invokeMock).toHaveBeenCalledWith('etoro-proxy', {
      body: { endpoint: 'balances-history', apiKey: 'k1', userKey: 'k2' },
    });
    expect(result.snapshots).toHaveLength(2);
  });

  it('sollte fromDate/toDate durchreichen', async () => {
    invokeMock.mockResolvedValue({ data: balancesHistoryResponse(), error: null } as never);

    await fetchEtoroBalancesHistory('k1', 'k2', { fromDate: '2026-01-01', toDate: '2026-02-01' });

    expect(invokeMock).toHaveBeenCalledWith('etoro-proxy', {
      body: { endpoint: 'balances-history', apiKey: 'k1', userKey: 'k2', fromDate: '2026-01-01', toDate: '2026-02-01' },
    });
  });

  it('[REGRESSION] sollte 401/403 als isAuthError markieren (fehlender money.balance:read-Scope)', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: 'unauthorized', context: { status: 401 } },
    } as never);
    await expect(fetchEtoroBalancesHistory('k1', 'k2')).rejects.toMatchObject({ isAuthError: true });
  });
});

describe('fetchEtoroBalancesHistoryForPortfolio (mit Credentials-Guard)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
    localEncryption.lock();
  });

  it('[SECURITY] sollte bei gesperrter Verschlüsselung werfen, ohne den Proxy zu rufen', async () => {
    await expect(fetchEtoroBalancesHistoryForPortfolio(etoroPortfolio())).rejects.toThrow(/Verschlüsselung/i);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

describe('fetchEtoroCashTransactions', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
  });

  it('sollte den cash-transactions-Endpoint mit accountId aufrufen und validierte Daten liefern', async () => {
    invokeMock.mockResolvedValue({ data: cashTransactionsResponse(), error: null } as never);

    const result = await fetchEtoroCashTransactions('k1', 'k2', 'cash-acc-1');

    expect(invokeMock).toHaveBeenCalledWith('etoro-proxy', {
      body: { endpoint: 'cash-transactions', apiKey: 'k1', userKey: 'k2', accountId: 'cash-acc-1' },
    });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].amount).toBe('2.50');
  });

  it('sollte pageSize/pageToken durchreichen', async () => {
    invokeMock.mockResolvedValue({ data: cashTransactionsResponse(), error: null } as never);

    await fetchEtoroCashTransactions('k1', 'k2', 'cash-acc-1', { pageSize: 100, pageToken: 'tok' });

    expect(invokeMock).toHaveBeenCalledWith('etoro-proxy', {
      body: { endpoint: 'cash-transactions', apiKey: 'k1', userKey: 'k2', accountId: 'cash-acc-1', pageSize: 100, pageToken: 'tok' },
    });
  });

  it('[REGRESSION] sollte 401/403 als isAuthError markieren (fehlender money.cash-transactions:read-Scope)', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: 'unauthorized', context: { status: 403 } },
    } as never);
    await expect(fetchEtoroCashTransactions('k1', 'k2', 'cash-acc-1')).rejects.toMatchObject({ isAuthError: true });
  });
});

describe('fetchEtoroCashTransactionsForPortfolio (mit Credentials-Guard)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
    localEncryption.lock();
  });

  it('[SECURITY] sollte bei gesperrter Verschlüsselung werfen, ohne den Proxy zu rufen', async () => {
    await expect(fetchEtoroCashTransactionsForPortfolio(etoroPortfolio(), 'cash-acc-1')).rejects.toThrow(/Verschlüsselung/i);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

// Fixture validiert sich selbst gegen das Schema (Issue-#195-Regel).
function watchlistsResponse() {
  return EtoroWatchlistsResponseSchema.parse({
    watchlists: [
      {
        watchlistId: '12345',
        name: 'Tech Watchlist',
        isUserSelectedDefault: true,
        items: [{ itemId: 1001, itemType: 'Instrument', market: { symbolName: 'AAPL' } }],
      },
    ],
  });
}

function priceAlertsResponse() {
  return EtoroPriceAlertsResponseSchema.parse({
    results: [
      {
        alertId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        instrumentId: 1001,
        symbol: 'AAPL',
        targetPrice: 185.5,
        currentPrice: 182.3,
      },
    ],
  });
}

describe('fetchEtoroWatchlists', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
  });

  it('sollte den watchlists-Endpoint über den Proxy aufrufen und validierte Daten liefern', async () => {
    invokeMock.mockResolvedValue({ data: watchlistsResponse(), error: null } as never);

    const result = await fetchEtoroWatchlists('k1', 'k2');

    expect(invokeMock).toHaveBeenCalledWith('etoro-proxy', {
      body: { endpoint: 'watchlists', apiKey: 'k1', userKey: 'k2' },
    });
    expect(result.watchlists).toHaveLength(1);
  });

  it('[REGRESSION] sollte 401/403 als isAuthError markieren (fehlender watchlist:read-Scope)', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: 'unauthorized', context: { status: 403 } },
    } as never);
    await expect(fetchEtoroWatchlists('k1', 'k2')).rejects.toMatchObject({ isAuthError: true });
  });

  it('[REGRESSION] sollte bei unerwartetem Antwort-Schema werfen statt still Müll zu liefern', async () => {
    invokeMock.mockResolvedValue({ data: { watchlists: [{ name: 'x' }] }, error: null } as never);
    await expect(fetchEtoroWatchlists('k1', 'k2')).rejects.toBeInstanceOf(EtoroAccountError);
  });
});

describe('fetchEtoroWatchlistsForPortfolio (mit Credentials-Guard)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
    localEncryption.lock();
  });

  it('[SECURITY] sollte bei gesperrter Verschlüsselung werfen, ohne den Proxy zu rufen', async () => {
    await expect(fetchEtoroWatchlistsForPortfolio(etoroPortfolio())).rejects.toThrow(/Verschlüsselung/i);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

describe('fetchEtoroWatchlistItems', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
  });

  it('sollte den watchlist-items-Endpoint mit watchlistId aufrufen und validierte Daten liefern', async () => {
    invokeMock.mockResolvedValue({ data: watchlistsResponse(), error: null } as never);

    const result = await fetchEtoroWatchlistItems('k1', 'k2', '12345');

    expect(invokeMock).toHaveBeenCalledWith('etoro-proxy', {
      body: { endpoint: 'watchlist-items', apiKey: 'k1', userKey: 'k2', watchlistId: '12345' },
    });
    expect(result.watchlists?.[0].items).toHaveLength(1);
  });

  it('sollte pageNumber/itemsPerPage durchreichen', async () => {
    invokeMock.mockResolvedValue({ data: watchlistsResponse(), error: null } as never);

    await fetchEtoroWatchlistItems('k1', 'k2', '12345', { pageNumber: 1, itemsPerPage: 200 });

    expect(invokeMock).toHaveBeenCalledWith('etoro-proxy', {
      body: { endpoint: 'watchlist-items', apiKey: 'k1', userKey: 'k2', watchlistId: '12345', pageNumber: 1, itemsPerPage: 200 },
    });
  });

  it('[REGRESSION] sollte 401/403 als isAuthError markieren (fehlender watchlist:read-Scope)', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: 'unauthorized', context: { status: 401 } },
    } as never);
    await expect(fetchEtoroWatchlistItems('k1', 'k2', '12345')).rejects.toMatchObject({ isAuthError: true });
  });
});

describe('fetchEtoroWatchlistItemsForPortfolio (mit Credentials-Guard)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
    localEncryption.lock();
  });

  it('[SECURITY] sollte bei gesperrter Verschlüsselung werfen, ohne den Proxy zu rufen', async () => {
    await expect(fetchEtoroWatchlistItemsForPortfolio(etoroPortfolio(), '12345')).rejects.toThrow(/Verschlüsselung/i);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

describe('fetchEtoroPriceAlerts', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
  });

  it('sollte den price-alerts-Endpoint über den Proxy aufrufen und validierte Daten liefern', async () => {
    invokeMock.mockResolvedValue({ data: priceAlertsResponse(), error: null } as never);

    const result = await fetchEtoroPriceAlerts('k1', 'k2');

    expect(invokeMock).toHaveBeenCalledWith('etoro-proxy', {
      body: { endpoint: 'price-alerts', apiKey: 'k1', userKey: 'k2' },
    });
    expect(result.results).toHaveLength(1);
    expect(result.results?.[0].targetPrice).toBe(185.5);
  });

  it('[REGRESSION] sollte 401/403 als isAuthError markieren (fehlender price-alerts:read-Scope)', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: 'unauthorized', context: { status: 403 } },
    } as never);
    await expect(fetchEtoroPriceAlerts('k1', 'k2')).rejects.toMatchObject({ isAuthError: true });
  });

  it('[REGRESSION] sollte bei unerwartetem Antwort-Schema werfen statt still Müll zu liefern', async () => {
    invokeMock.mockResolvedValue({ data: { results: [{ alertId: 'x' }] }, error: null } as never);
    await expect(fetchEtoroPriceAlerts('k1', 'k2')).rejects.toBeInstanceOf(EtoroAccountError);
  });
});

describe('fetchEtoroPriceAlertsForPortfolio (mit Credentials-Guard)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
    localEncryption.lock();
  });

  it('[SECURITY] sollte bei gesperrter Verschlüsselung werfen, ohne den Proxy zu rufen', async () => {
    await expect(fetchEtoroPriceAlertsForPortfolio(etoroPortfolio())).rejects.toThrow(/Verschlüsselung/i);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
