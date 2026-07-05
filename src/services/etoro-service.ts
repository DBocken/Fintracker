import type { Portfolio, PortfolioPosition } from '../types';
import { supabase } from '@/integrations/supabase/client';
import {
  createPortfolio,
  createPosition,
  deletePosition,
  getPortfolioById,
  getPositions,
  updatePosition,
} from './portfolio-service';
import { localEncryption } from './local-crypto';
import { t } from '../i18n/serviceT';

// -----------------------------------------------------------------------------
// eToro API Types
// -----------------------------------------------------------------------------

export interface EtoroPosition {
  PositionID: string | number;
  InstrumentID: string | number;
  InstrumentSymbol: string;
  InstrumentDisplayName: string;
  IsBuy: boolean;
  Amount: number;
  Leverage: number;
  OpenRate: number;
  StopLossRate?: number;
  TakeProfitRate?: number;
  Units: number;
  Closed?: boolean;
  CloseRate?: number;
  CloseDate?: string;
  OpenDate: string;
  IsTournament: boolean;
  CopyTradingParentID?: string;
  Profit?: number;
}

export interface EtoroSyncResult {
  created: number;
  updated: number;
  removed: number;
}

// -----------------------------------------------------------------------------
// eToro API via Edge-Proxy
//
// Die eToro-API erlaubt keine Browser-Direktaufrufe (CORS). Die Keys bleiben
// lokal verschlüsselt gespeichert und werden pro Request durch die zustandslose
// Edge Function `etoro-proxy` gereicht — dort weder gespeichert noch geloggt.
// -----------------------------------------------------------------------------

async function callEtoroProxy(
  apiKey: string,
  userKey: string,
  endpoint: 'portfolio' | 'demo-portfolio' = 'portfolio',
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('etoro-proxy', {
    body: { endpoint, apiKey, userKey },
  });

  if (error) {
    throw new Error(t('etoroService.proxyError').replace('{error}', error.message || String(error)));
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(t('etoroService.proxyError').replace('{error}', String(data.error)));
  }

  return (data || {}) as Record<string, unknown>;
}

/**
 * Test eToro API connection
 */
export async function testEtoroConnection(apiKey: string, userKey: string): Promise<boolean> {
  try {
    await callEtoroProxy(apiKey, userKey);
    return true;
  } catch (error) {
    console.error('[etoro-service] Connection test failed:', error);
    return false;
  }
}

/**
 * Fetch portfolio positions from eToro (via Edge-Proxy).
 */
export async function fetchEtoroPortfolio(
  apiKey: string,
  userKey: string,
): Promise<EtoroPosition[]> {
  const data = await callEtoroProxy(apiKey, userKey);

  const clientPortfolio = data.clientPortfolio as { positions?: EtoroPosition[] } | undefined;
  if (clientPortfolio?.positions) return clientPortfolio.positions;
  if (Array.isArray((data as { positions?: EtoroPosition[] }).positions)) {
    return (data as { positions: EtoroPosition[] }).positions;
  }
  return [];
}

// -----------------------------------------------------------------------------
// Mapping & Merge
// -----------------------------------------------------------------------------

function etoroMetadata(etoroPosition: EtoroPosition): Record<string, unknown> {
  return {
    etoro_position_id: String(etoroPosition.PositionID),
    etoro_instrument_id: etoroPosition.InstrumentID,
    is_buy: etoroPosition.IsBuy,
    leverage: etoroPosition.Leverage,
    open_date: etoroPosition.OpenDate,
    stop_loss_rate: etoroPosition.StopLossRate,
    take_profit_rate: etoroPosition.TakeProfitRate,
    copy_trading_parent_id: etoroPosition.CopyTradingParentID,
    profit: etoroPosition.Profit,
  };
}

function etoroPositionToPortfolioPosition(
  etoroPosition: EtoroPosition,
  portfolioId: string,
): Partial<PortfolioPosition> {
  return {
    portfolio_id: portfolioId,
    symbol: etoroPosition.InstrumentSymbol.toUpperCase(),
    name: etoroPosition.InstrumentDisplayName || etoroPosition.InstrumentSymbol,
    // Short-Positionen liefern negative Units — wir führen Bestände als Stückzahl
    quantity: Math.abs(etoroPosition.Units),
    entry_price: etoroPosition.OpenRate,
    currency: 'USD', // eToro führt Konten in USD
    exchange: 'ETORO',
    metadata: etoroMetadata(etoroPosition),
  };
}

export interface EtoroMergePlan {
  toCreate: EtoroPosition[];
  toUpdate: Array<{ id: string; updates: Partial<PortfolioPosition> }>;
  toDeleteIds: string[];
}

/**
 * Plant den Abgleich lokaler Positionen mit dem eToro-Stand.
 *
 * Abgleich ausschließlich über metadata.etoro_position_id: manuell erfasste
 * Positionen (ohne diese ID) werden nie angefasst — der Sync darf nur Daten
 * verwalten, die er selbst importiert hat.
 */
export function mergeEtoroPositions(
  existing: PortfolioPosition[],
  incoming: EtoroPosition[],
): EtoroMergePlan {
  const open = incoming.filter((position) => !position.Closed);

  const existingByEtoroId = new Map<string, PortfolioPosition>();
  for (const position of existing) {
    const etoroId = position.metadata?.etoro_position_id;
    if (etoroId != null) existingByEtoroId.set(String(etoroId), position);
  }

  const seen = new Set<string>();
  const toCreate: EtoroPosition[] = [];
  const toUpdate: EtoroMergePlan['toUpdate'] = [];

  for (const position of open) {
    const etoroId = String(position.PositionID);
    seen.add(etoroId);

    const match = existingByEtoroId.get(etoroId);
    if (!match) {
      toCreate.push(position);
    } else {
      toUpdate.push({
        id: match.id,
        updates: {
          quantity: Math.abs(position.Units),
          entry_price: position.OpenRate,
          name: position.InstrumentDisplayName || match.name,
          metadata: { ...match.metadata, ...etoroMetadata(position) },
        },
      });
    }
  }

  const toDeleteIds = [...existingByEtoroId.entries()]
    .filter(([etoroId]) => !seen.has(etoroId))
    .map(([, position]) => position.id);

  return { toCreate, toUpdate, toDeleteIds };
}

// -----------------------------------------------------------------------------
// Connect & Sync
// -----------------------------------------------------------------------------

/**
 * Connect eToro account and create portfolio
 */
export async function connectEtoroAccount(
  username: string,
  apiKey: string,
  userKey: string,
): Promise<Portfolio> {
  // Broker-Credentials sind deutlich sensibler als die übrigen Finanzdaten
  // (voller Zugriff aufs Handelskonto). Sie dürfen nur gespeichert werden, wenn
  // die lokale Verschlüsselung aktiv und entsperrt ist — sonst lägen sie im
  // Klartext in IndexedDB und in unverschlüsselten Backups (T1.10 / F-DEBT-1).
  if (!localEncryption.isUnlocked()) {
    throw new Error(t('etoroService.encryptionRequired'));
  }

  let etoroPositions: EtoroPosition[];
  try {
    etoroPositions = await fetchEtoroPortfolio(apiKey, userKey);
  } catch (error) {
    console.error('[etoro-service] Connection failed:', error);
    throw new Error(t('etoroService.connectionFailed'));
  }

  const portfolio = await createPortfolio({
    name: `eToro - ${username}`,
    type: 'etoro',
    provider_config: {
      username,
      apiKey,
      userKey,
      connected_at: new Date().toISOString(),
    },
    currency: 'USD',
    is_active: true,
  });

  for (const etoroPosition of etoroPositions.filter((position) => !position.Closed)) {
    try {
      await createPosition(etoroPositionToPortfolioPosition(etoroPosition, portfolio.id));
    } catch (error) {
      console.error(
        `[etoro-service] Failed to import position ${etoroPosition.InstrumentSymbol}:`,
        error,
      );
      // Continue with other positions even if one fails
    }
  }

  return portfolio;
}

/**
 * Gleicht ein eToro-Portfolio mit dem Live-Stand ab und persistiert das
 * Ergebnis dauerhaft im lokalen Store (Issue #107): neue Positionen anlegen,
 * bestehende aktualisieren, geschlossene entfernen. Manuelle Positionen
 * bleiben unberührt.
 */
export async function syncEtoroPortfolio(portfolioId: string): Promise<EtoroSyncResult> {
  // Gleiches Schutzniveau wie beim Verbinden: ohne entsperrte Verschlüsselung
  // keine Verwendung der gespeicherten Broker-Credentials.
  if (!localEncryption.isUnlocked()) {
    throw new Error(t('etoroService.encryptionRequired'));
  }

  const portfolio = await getPortfolioById(portfolioId);
  if (!portfolio || portfolio.type !== 'etoro') {
    throw new Error(t('etoroService.notEtoroPortfolio'));
  }

  const apiKey = portfolio.provider_config?.apiKey as string | undefined;
  const userKey = portfolio.provider_config?.userKey as string | undefined;
  if (!apiKey || !userKey) {
    throw new Error(t('etoroService.credentialsMissing'));
  }

  const incoming = await fetchEtoroPortfolio(apiKey, userKey);
  const existing = await getPositions(portfolioId);

  const { toCreate, toUpdate, toDeleteIds } = mergeEtoroPositions(existing, incoming);

  for (const etoroPosition of toCreate) {
    await createPosition(etoroPositionToPortfolioPosition(etoroPosition, portfolioId));
  }
  for (const update of toUpdate) {
    await updatePosition(update.id, update.updates);
  }
  for (const id of toDeleteIds) {
    await deletePosition(id);
  }

  return { created: toCreate.length, updated: toUpdate.length, removed: toDeleteIds.length };
}

/**
 * Get eToro portfolio statistics
 */
export async function getEtoroPortfolioStats(portfolioId: string) {
  const portfolio = await getPortfolioById(portfolioId);

  if (!portfolio || portfolio.type !== 'etoro') {
    return null;
  }

  return {
    username: portfolio.provider_config?.username,
    connected_at: portfolio.provider_config?.connected_at,
    last_sync: portfolio.updated_at,
  };
}
