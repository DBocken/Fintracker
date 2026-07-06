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
  EtoroAccountError,
} from '../etoro-account-service';
import { EtoroAggregatePortfolioResponseSchema } from '../etoro-api-schemas';
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
