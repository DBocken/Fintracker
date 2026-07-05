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
  fetchEtoroInstrumentMeta,
  syncEtoroPortfolio,
  connectEtoroAccount,
} from '../etoro-service';
import { createPortfolio, createPosition, getPositions } from '../portfolio-service';
import { translations } from '../../i18n/translations';
import { EtoroInstrumentDisplayDataSchema } from '../etoro-api-schemas';

const invokeMock = vi.mocked(supabase.functions.invoke);

// Echtes eToro-API-Schema (camelCase, nur instrumentID — kein Symbol/Name
// in der Portfolio-Antwort selbst, siehe api-portal.etoro.com Referenz).
function etoroPosition(overrides: Record<string, unknown> = {}) {
  return {
    positionID: 2150896073,
    instrumentID: 1001,
    isBuy: true,
    units: 6.5,
    openRate: 150,
    leverage: 1,
    amount: 975,
    openDateTime: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// Validiert gegen etoro-api-schemas.ts (aus der Live-API-Spec abgeleitet):
// ein Tippfehler oder ein erfundenes Feld hier lässt den Test sofort mit
// einer ZodError fehlschlagen, statt still ein falsches Mock zu bestehen
// (siehe Issue #195 — genau dieser Fehler blieb sonst unentdeckt).
function instrumentMetaResponse(overrides: Record<string, unknown> = {}) {
  return EtoroInstrumentDisplayDataSchema.parse({
    instrumentID: 1001,
    symbolFull: 'AAPL',
    instrumentDisplayName: 'Apple Inc.',
    ...overrides,
  });
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
    metadata: { etoro_position_id: '2150896073', etoro_instrument_id: 1001 },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as PortfolioPosition;
}

const instrumentMeta = new Map([[1001, { symbol: 'AAPL', name: 'Apple Inc.' }]]);

describe('mergeEtoroPositions', () => {
  describe('Normal Behavior', () => {
    it('sollte alle Positionen anlegen wenn lokal nichts existiert', () => {
      const result = mergeEtoroPositions(
        [],
        [etoroPosition(), etoroPosition({ positionID: 2150896074, instrumentID: 1002 })],
        instrumentMeta,
      );
      expect(result.toCreate).toHaveLength(2);
      expect(result.toUpdate).toHaveLength(0);
      expect(result.toDeleteIds).toHaveLength(0);
    });

    it('sollte bestehende Positionen anhand der positionID aktualisieren', () => {
      const result = mergeEtoroPositions(
        [localEtoroPosition()],
        [etoroPosition({ units: 10, openRate: 155 })],
        instrumentMeta,
      );
      expect(result.toCreate).toHaveLength(0);
      expect(result.toDeleteIds).toHaveLength(0);
      expect(result.toUpdate).toHaveLength(1);
      expect(result.toUpdate[0].id).toBe('local-1');
      expect(result.toUpdate[0].updates.quantity).toBe(10);
      expect(result.toUpdate[0].updates.entry_price).toBe(155);
    });

    it('sollte lokale eToro-Positionen entfernen die bei eToro nicht mehr offen sind', () => {
      const result = mergeEtoroPositions([localEtoroPosition()], [], instrumentMeta);
      expect(result.toDeleteIds).toEqual(['local-1']);
    });

    it('[REGRESSION] sollte Fallback-Symbole (ETORO-<id>) beim Re-Sync durch aufgelöste Symbole ersetzen', () => {
      // Erster Sync ohne erreichbaren Instrument-Lookup legt Platzhalter an;
      // sobald die Auflösung wieder funktioniert, muss ein erneuter Sync
      // Symbol UND Name heilen — sonst bleiben die Platzhalter für immer.
      const placeholder = localEtoroPosition({ symbol: 'ETORO-1001', name: 'ETORO-1001' });
      const result = mergeEtoroPositions([placeholder], [etoroPosition()], instrumentMeta);
      expect(result.toUpdate).toHaveLength(1);
      expect(result.toUpdate[0].updates.symbol).toBe('AAPL');
      expect(result.toUpdate[0].updates.name).toBe('Apple Inc.');
    });
  });

  describe('Edge Cases', () => {
    it('sollte manuell erfasste Positionen (ohne etoro_position_id) niemals löschen', () => {
      const manual = localEtoroPosition({ id: 'manual-1', metadata: {} });
      const result = mergeEtoroPositions([manual], [], instrumentMeta);
      expect(result.toDeleteIds).toHaveLength(0);
    });

    it('sollte mit leeren Arrays auf beiden Seiten umgehen', () => {
      const result = mergeEtoroPositions([], [], instrumentMeta);
      expect(result.toCreate).toHaveLength(0);
      expect(result.toUpdate).toHaveLength(0);
      expect(result.toDeleteIds).toHaveLength(0);
    });

    it('sollte Short-Positionen mit positiver Stückzahl übernehmen', () => {
      const created = mergeEtoroPositions([], [etoroPosition({ isBuy: false, units: -3 })], instrumentMeta);
      expect(created.toCreate).toHaveLength(1);
      const updated = mergeEtoroPositions([localEtoroPosition()], [etoroPosition({ units: -3 })], instrumentMeta);
      expect(updated.toUpdate[0].updates.quantity).toBe(3);
    });
  });
});

describe('fetchEtoroPortfolio (Edge-Proxy)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('sollte Positionen über die etoro-proxy Edge Function laden (kein Direkt-Call, echtes Schema)', async () => {
    invokeMock.mockResolvedValue({
      data: { clientPortfolio: { positions: [etoroPosition()] } },
      error: null,
    } as never);

    const positions = await fetchEtoroPortfolio('api-key', 'user-key');

    expect(invokeMock).toHaveBeenCalledWith('etoro-proxy', {
      body: { endpoint: 'portfolio', apiKey: 'api-key', userKey: 'user-key' },
    });
    expect(positions).toHaveLength(1);
    expect(positions[0].positionID).toBe(2150896073);
    expect(positions[0].instrumentID).toBe(1001);
  });

  it('sollte einen Fehler werfen wenn der Proxy einen Fehler liefert', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: 'boom' } } as never);
    await expect(fetchEtoroPortfolio('api-key', 'user-key')).rejects.toThrow();
  });
});

describe('fetchEtoroInstrumentMeta', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('[REGRESSION] sollte Symbol/Name aus der echten API-Hülle { instrumentDisplayDatas } auflösen', async () => {
    // Live eToro API (v1.291.0) wickelt die Ergebnisse in instrumentDisplayDatas ein —
    // kein nacktes Array. Ohne diese Hülle bleibt die Map leer (Regression: Placeholder
    // heilen nie, obwohl der Proxy korrekt antwortet).
    invokeMock.mockResolvedValue({
      data: {
        instrumentDisplayDatas: [
          instrumentMetaResponse(),
          instrumentMetaResponse({ instrumentID: 1002, symbolFull: 'MSFT', instrumentDisplayName: 'Microsoft' }),
        ],
      },
      error: null,
    } as never);

    const meta = await fetchEtoroInstrumentMeta('api-key', 'user-key', [1001, 1002]);

    expect(invokeMock).toHaveBeenCalledWith('etoro-proxy', {
      body: { endpoint: 'instruments', apiKey: 'api-key', userKey: 'user-key', instrumentIds: [1001, 1002] },
    });
    expect(meta.get(1001)).toEqual({ symbol: 'AAPL', name: 'Apple Inc.' });
    expect(meta.get(1002)).toEqual({ symbol: 'MSFT', name: 'Microsoft' });
  });

  it('sollte auch ein nacktes Array als Antwort akzeptieren (Kompatibilität)', async () => {
    invokeMock.mockResolvedValue({
      data: [instrumentMetaResponse(), instrumentMetaResponse({ instrumentID: 1002, symbolFull: 'MSFT', instrumentDisplayName: 'Microsoft' })],
      error: null,
    } as never);

    const meta = await fetchEtoroInstrumentMeta('api-key', 'user-key', [1001, 1002]);

    expect(meta.get(1001)).toEqual({ symbol: 'AAPL', name: 'Apple Inc.' });
    expect(meta.get(1002)).toEqual({ symbol: 'MSFT', name: 'Microsoft' });
  });

  it('sollte mit leerer ID-Liste keinen Aufruf machen und eine leere Map liefern', async () => {
    const meta = await fetchEtoroInstrumentMeta('api-key', 'user-key', []);
    expect(meta.size).toBe(0);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('[REGRESSION] sollte bei Proxy-Fehler eine leere Map liefern statt zu werfen (Sync bricht nicht ab)', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: 'boom' } } as never);
    const meta = await fetchEtoroInstrumentMeta('api-key', 'user-key', [1001]);
    expect(meta.size).toBe(0);
  });
});

describe('syncEtoroPortfolio', () => {
  beforeEach(async () => {
    localStorage.clear();
    window.localStorage.setItem('ausgabentracker_locale_v1', 'de');
    localEncryption.lock();
    invokeMock.mockReset();
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

  it('[REGRESSION] Issue #107/#192: persistiert Positionen mit echtem eToro-Schema (anlegen/aktualisieren/entfernen, Symbol via Instrument-Lookup)', async () => {
    await localEncryption.enable('test-passwort-123');

    const portfolio = await createPortfolio({
      name: 'eToro - nutzer',
      type: 'etoro',
      provider_config: { username: 'nutzer', apiKey: 'k1', userKey: 'k2' },
      currency: 'USD',
    });

    await createPosition({
      portfolio_id: portfolio.id,
      symbol: 'AAPL',
      quantity: 5,
      entry_price: 150,
      metadata: { etoro_position_id: '2150896073', etoro_instrument_id: 1001 },
    });
    await createPosition({
      portfolio_id: portfolio.id,
      symbol: 'MANUAL',
      quantity: 1,
      entry_price: 10,
      metadata: {},
    });

    // 1. Aufruf: Portfolio-Positionen (camelCase, kein Symbol enthalten)
    invokeMock.mockImplementation((async (_fn: string, opts: { body: { endpoint: string } }) => {
      if (opts.body.endpoint === 'portfolio') {
        return {
          data: {
            clientPortfolio: {
              positions: [
                etoroPosition({ positionID: 2150896073, instrumentID: 1001, units: 8, openRate: 152 }),
                etoroPosition({ positionID: 2150896099, instrumentID: 1002 }),
              ],
            },
          },
          error: null,
        };
      }
      if (opts.body.endpoint === 'instruments') {
        return {
          data: [
            instrumentMetaResponse({ instrumentID: 1001, symbolFull: 'AAPL', instrumentDisplayName: 'Apple Inc.' }),
            instrumentMetaResponse({ instrumentID: 1002, symbolFull: 'MSFT', instrumentDisplayName: 'Microsoft' }),
          ],
          error: null,
        };
      }
      throw new Error('unexpected endpoint');
    }) as any);

    const result = await syncEtoroPortfolio(portfolio.id);
    expect(result).toEqual({ created: 1, updated: 1, removed: 0 });

    const positions = await getPositions(portfolio.id);
    expect(positions).toHaveLength(3);

    const aapl = positions.find((p) => p.metadata?.etoro_position_id === '2150896073');
    expect(aapl?.quantity).toBe(8);
    expect(aapl?.entry_price).toBe(152);

    const msft = positions.find((p) => p.metadata?.etoro_position_id === '2150896099');
    expect(msft?.symbol).toBe('MSFT');
    expect(msft?.name).toBe('Microsoft');

    expect(positions.some((p) => p.symbol === 'MANUAL')).toBe(true);

    // 2. Sync: pos 2150896073 ist bei eToro nicht mehr offen → lokal entfernen
    invokeMock.mockImplementation((async (_fn: string, opts: { body: { endpoint: string } }) => {
      if (opts.body.endpoint === 'portfolio') {
        return {
          data: { clientPortfolio: { positions: [etoroPosition({ positionID: 2150896099, instrumentID: 1002 })] } },
          error: null,
        };
      }
      return {
        data: [instrumentMetaResponse({ instrumentID: 1002, symbolFull: 'MSFT', instrumentDisplayName: 'Microsoft' })],
        error: null,
      };
    }) as any);

    const second = await syncEtoroPortfolio(portfolio.id);
    expect(second.removed).toBe(1);

    const after = await getPositions(portfolio.id);
    expect(after.some((p) => p.metadata?.etoro_position_id === '2150896073')).toBe(false);
    expect(after.some((p) => p.symbol === 'MANUAL')).toBe(true);
  });

  it('[REGRESSION] sollte bei fehlgeschlagener Instrument-Auflösung einen Fallback-Symbolnamen nutzen statt abzustürzen', async () => {
    await localEncryption.enable('test-passwort-123');
    const portfolio = await createPortfolio({
      name: 'eToro - nutzer',
      type: 'etoro',
      provider_config: { username: 'nutzer', apiKey: 'k1', userKey: 'k2' },
      currency: 'USD',
    });

    invokeMock.mockImplementation((async (_fn: string, opts: { body: { endpoint: string } }) => {
      if (opts.body.endpoint === 'portfolio') {
        return { data: { clientPortfolio: { positions: [etoroPosition()] } }, error: null };
      }
      // Instrument-Lookup schlägt fehl — darf den Sync nicht crashen lassen.
      return { data: null, error: { message: 'instruments down' } };
    }) as any);

    const result = await syncEtoroPortfolio(portfolio.id);
    expect(result.created).toBe(1);

    const positions = await getPositions(portfolio.id);
    expect(positions[0].symbol).toBe('ETORO-1001');
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

  it('sollte Portfolio samt aufgelösten Positionen über den Proxy anlegen', async () => {
    await localEncryption.enable('test-passwort-123');
    invokeMock.mockImplementation((async (_fn: string, opts: { body: { endpoint: string } }) => {
      if (opts.body.endpoint === 'portfolio') {
        return { data: { clientPortfolio: { positions: [etoroPosition()] } }, error: null };
      }
      return { data: [instrumentMetaResponse()], error: null };
    }) as any);

    const portfolio = await connectEtoroAccount('nutzer', 'k1', 'k2');
    expect(portfolio.type).toBe('etoro');

    const positions = await getPositions(portfolio.id);
    expect(positions).toHaveLength(1);
    expect(positions[0].symbol).toBe('AAPL');
    expect(positions[0].name).toBe('Apple Inc.');
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
