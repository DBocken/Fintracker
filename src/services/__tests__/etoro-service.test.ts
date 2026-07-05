import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PortfolioPosition } from '../../types';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  },
}));

import { supabase } from '@/integrations/supabase/client';
import { localEncryption } from '../local-crypto';
import {
  mergeEtoroPositions,
  fetchEtoroPortfolio,
  syncEtoroPortfolio,
  connectEtoroAccount,
} from '../etoro-service';
import { createPortfolio, createPosition, getPositions } from '../portfolio-service';
import { translations } from '../../i18n/translations';

const invokeMock = vi.mocked(supabase.functions.invoke);

function etoroPosition(overrides: Record<string, unknown> = {}) {
  return {
    PositionID: 'pos-1',
    InstrumentID: '1001',
    InstrumentSymbol: 'aapl',
    InstrumentDisplayName: 'Apple Inc.',
    IsBuy: true,
    Amount: 1000,
    Leverage: 1,
    OpenRate: 150,
    Units: 6.5,
    OpenDate: '2026-01-01T00:00:00Z',
    IsTournament: false,
    ...overrides,
  };
}

function localEtoroPosition(overrides: Partial<PortfolioPosition> = {}): PortfolioPosition {
  return {
    id: 'local-1',
    portfolio_id: 'pf-1',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    quantity: 6.5,
    entry_price: 150,
    currency: 'USD',
    exchange: 'ETORO',
    metadata: { etoro_position_id: 'pos-1' },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as PortfolioPosition;
}

describe('mergeEtoroPositions', () => {
  describe('Normal Behavior', () => {
    it('sollte alle offenen Positionen anlegen wenn lokal nichts existiert', () => {
      const result = mergeEtoroPositions([], [etoroPosition(), etoroPosition({ PositionID: 'pos-2' })]);
      expect(result.toCreate).toHaveLength(2);
      expect(result.toUpdate).toHaveLength(0);
      expect(result.toDeleteIds).toHaveLength(0);
    });

    it('sollte bestehende Positionen anhand der etoro_position_id aktualisieren', () => {
      const result = mergeEtoroPositions(
        [localEtoroPosition()],
        [etoroPosition({ Units: 10, OpenRate: 155 })],
      );
      expect(result.toCreate).toHaveLength(0);
      expect(result.toDeleteIds).toHaveLength(0);
      expect(result.toUpdate).toHaveLength(1);
      expect(result.toUpdate[0].id).toBe('local-1');
      expect(result.toUpdate[0].updates.quantity).toBe(10);
      expect(result.toUpdate[0].updates.entry_price).toBe(155);
    });

    it('sollte lokale eToro-Positionen entfernen die bei eToro nicht mehr offen sind', () => {
      const result = mergeEtoroPositions([localEtoroPosition()], []);
      expect(result.toDeleteIds).toEqual(['local-1']);
    });
  });

  describe('Edge Cases', () => {
    it('sollte manuell erfasste Positionen (ohne etoro_position_id) niemals löschen', () => {
      const manual = localEtoroPosition({ id: 'manual-1', metadata: {} });
      const result = mergeEtoroPositions([manual], []);
      expect(result.toDeleteIds).toHaveLength(0);
    });

    it('sollte geschlossene eToro-Positionen ignorieren (nicht anlegen, lokal entfernen)', () => {
      const result = mergeEtoroPositions(
        [localEtoroPosition()],
        [etoroPosition({ Closed: true })],
      );
      expect(result.toCreate).toHaveLength(0);
      expect(result.toDeleteIds).toEqual(['local-1']);
    });

    it('sollte mit leeren Arrays auf beiden Seiten umgehen', () => {
      const result = mergeEtoroPositions([], []);
      expect(result.toCreate).toHaveLength(0);
      expect(result.toUpdate).toHaveLength(0);
      expect(result.toDeleteIds).toHaveLength(0);
    });

    it('sollte Short-Positionen mit positiver Stückzahl übernehmen', () => {
      const result = mergeEtoroPositions([], [etoroPosition({ IsBuy: false, Units: -3 })]);
      expect(result.toCreate).toHaveLength(1);
      const merged = mergeEtoroPositions([localEtoroPosition()], [etoroPosition({ Units: -3 })]);
      expect(merged.toUpdate[0].updates.quantity).toBe(3);
    });
  });
});

describe('fetchEtoroPortfolio (Edge-Proxy)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('sollte Positionen über die etoro-proxy Edge Function laden (kein Direkt-Call)', async () => {
    invokeMock.mockResolvedValue({
      data: { clientPortfolio: { positions: [etoroPosition()] } },
      error: null,
    } as never);

    const positions = await fetchEtoroPortfolio('api-key', 'user-key');

    expect(invokeMock).toHaveBeenCalledWith('etoro-proxy', {
      body: { endpoint: 'portfolio', apiKey: 'api-key', userKey: 'user-key' },
    });
    expect(positions).toHaveLength(1);
    expect(positions[0].PositionID).toBe('pos-1');
  });

  it('sollte einen Fehler werfen wenn der Proxy einen Fehler liefert', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: 'boom' } } as never);
    await expect(fetchEtoroPortfolio('api-key', 'user-key')).rejects.toThrow();
  });
});

describe('syncEtoroPortfolio', () => {
  beforeEach(async () => {
    localStorage.clear();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
    localEncryption.lock();
    invokeMock.mockReset();
    // Lokalen Store leeren (IndexedDB-Reste aus vorherigen Tests)
    const { clearLocalKvStore } = await import('../idb-kv');
    await clearLocalKvStore();
  });

  it('[SECURITY] verweigert den Sync solange die Verschlüsselung gesperrt ist', async () => {
    await expect(syncEtoroPortfolio('irgendeine-id')).rejects.toThrow(/Verschlüsselung/i);
  });

  it('sollte einen Fehler werfen wenn das Portfolio kein eToro-Portfolio ist', async () => {
    await localEncryption.enable('test-passwort-123');
    const portfolio = await createPortfolio({ name: 'Manuell', type: 'manual' });
    await expect(syncEtoroPortfolio(portfolio.id)).rejects.toThrow();
  });

  it('[REGRESSION] Issue #107: persistiert Positionen dauerhaft im lokalen Store (anlegen/aktualisieren/entfernen)', async () => {
    await localEncryption.enable('test-passwort-123');

    const portfolio = await createPortfolio({
      name: 'eToro - nutzer',
      type: 'etoro',
      provider_config: { username: 'nutzer', apiKey: 'k1', userKey: 'k2' },
      currency: 'USD',
    });

    // Ausgangslage: eine bestehende eToro-Position + eine manuelle Position
    await createPosition({
      portfolio_id: portfolio.id,
      symbol: 'AAPL',
      quantity: 5,
      entry_price: 150,
      metadata: { etoro_position_id: 'pos-1' },
    });
    await createPosition({
      portfolio_id: portfolio.id,
      symbol: 'MANUAL',
      quantity: 1,
      entry_price: 10,
      metadata: {},
    });

    // eToro liefert: pos-1 mit neuer Stückzahl, pos-2 neu; eine alte Position fehlt nicht
    invokeMock.mockResolvedValue({
      data: {
        clientPortfolio: {
          positions: [
            etoroPosition({ PositionID: 'pos-1', Units: 8, OpenRate: 152 }),
            etoroPosition({ PositionID: 'pos-2', InstrumentSymbol: 'MSFT', InstrumentDisplayName: 'Microsoft' }),
          ],
        },
      },
      error: null,
    } as never);

    const result = await syncEtoroPortfolio(portfolio.id);

    expect(result).toEqual({ created: 1, updated: 1, removed: 0 });

    const positions = await getPositions(portfolio.id);
    expect(positions).toHaveLength(3);

    const aapl = positions.find((p) => p.metadata?.etoro_position_id === 'pos-1');
    expect(aapl?.quantity).toBe(8);
    expect(aapl?.entry_price).toBe(152);

    const msft = positions.find((p) => p.metadata?.etoro_position_id === 'pos-2');
    expect(msft?.symbol).toBe('MSFT');

    // Manuelle Position bleibt unangetastet
    expect(positions.some((p) => p.symbol === 'MANUAL')).toBe(true);

    // Zweiter Sync: pos-1 wurde bei eToro geschlossen → lokal entfernen
    invokeMock.mockResolvedValue({
      data: {
        clientPortfolio: {
          positions: [etoroPosition({ PositionID: 'pos-2', InstrumentSymbol: 'MSFT' })],
        },
      },
      error: null,
    } as never);

    const second = await syncEtoroPortfolio(portfolio.id);
    expect(second.removed).toBe(1);

    const after = await getPositions(portfolio.id);
    expect(after.some((p) => p.metadata?.etoro_position_id === 'pos-1')).toBe(false);
    expect(after.some((p) => p.symbol === 'MANUAL')).toBe(true);
  });
});

describe('connectEtoroAccount', () => {
  beforeEach(async () => {
    localStorage.clear();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
    localEncryption.lock();
    invokeMock.mockReset();
    const { clearLocalKvStore } = await import('../idb-kv');
    await clearLocalKvStore();
  });

  it('sollte Portfolio samt Positionen über den Proxy anlegen', async () => {
    await localEncryption.enable('test-passwort-123');
    invokeMock.mockResolvedValue({
      data: { clientPortfolio: { positions: [etoroPosition()] } },
      error: null,
    } as never);

    const portfolio = await connectEtoroAccount('nutzer', 'k1', 'k2');
    expect(portfolio.type).toBe('etoro');

    const positions = await getPositions(portfolio.id);
    expect(positions).toHaveLength(1);
    expect(positions[0].symbol).toBe('AAPL');
  });
});

describe('i18n-Compliance', () => {
  it('[REGRESSION] sollte alle neuen eToro-i18n-Keys in beiden Sprachen haben', () => {
    const keys = [
      'etoroService.notEtoroPortfolio',
      'etoroService.credentialsMissing',
      'etoroService.proxyError',
      'trading.etoroConnectDialog.proxyNote',
      'trading.dashboard.syncEtoro',
      'trading.dashboard.messages.etoroSyncSuccess',
    ];
    const { de, en } = translations;
    keys.forEach((key) => {
      const path = key.split('.');
      let deValue = de as Record<string, unknown>;
      let enValue = en as Record<string, unknown>;
      path.forEach((p) => {
        expect(deValue[p], `de: ${key}`).toBeDefined();
        expect(enValue[p], `en: ${key}`).toBeDefined();
        deValue = deValue[p] as Record<string, unknown>;
        enValue = enValue[p] as Record<string, unknown>;
      });
    });
  });
});
