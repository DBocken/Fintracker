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
  EtoroAccountError,
} from '../etoro-account-service';
import {
  EtoroAggregatePortfolioResponseSchema,
  EtoroTradeHistoryResponseSchema,
  EtoroPnlResponseSchema,
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
