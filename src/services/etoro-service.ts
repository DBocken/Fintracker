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
import { EtoroInstrumentsResponseSchema, EtoroLiveRatesResponseSchema } from './etoro-api-schemas';

// -----------------------------------------------------------------------------
// eToro API Types (echtes Schema — camelCase, siehe api-portal.etoro.com
// "Retrieve comprehensive portfolio information..."). Die Portfolio-Antwort
// enthält NUR instrumentID, kein Symbol/Name — das muss separat über
// /market-data/instruments aufgelöst werden (fetchEtoroInstrumentMeta).
// -----------------------------------------------------------------------------

export interface EtoroPosition {
  positionID: string | number;
  instrumentID: number;
  isBuy: boolean;
  units: number;
  openRate: number;
  leverage?: number;
  amount?: number;
  openDateTime?: string;
  takeProfitRate?: number;
  stopLossRate?: number;
}

export interface EtoroInstrumentMeta {
  symbol: string;
  name?: string;
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

export async function callEtoroProxy(
  apiKey: string,
  userKey: string,
  extra: Record<string, unknown>,
): Promise<{ data: unknown; error: { message?: string } | null }> {
  const { data, error } = await supabase.functions.invoke('etoro-proxy', {
    body: { apiKey, userKey, ...extra },
  });
  return { data, error };
}

/**
 * Liest die (lokal verschlüsselt gespeicherten) eToro-Credentials eines
 * Portfolios aus — mit demselben Schutzniveau wie Connect/Sync: ohne
 * entsperrte Verschlüsselung kein Zugriff. Zentral, damit alle Live-Abfragen
 * (Account-Service) denselben Guard nutzen.
 */
export function getEtoroCredentials(portfolio: Portfolio | null): { apiKey: string; userKey: string } {
  if (!localEncryption.isUnlocked()) {
    throw new Error(t('etoroService.encryptionRequired'));
  }
  if (!portfolio || portfolio.type !== 'etoro') {
    throw new Error(t('etoroService.notEtoroPortfolio'));
  }
  const apiKey = portfolio.provider_config?.apiKey as string | undefined;
  const userKey = portfolio.provider_config?.userKey as string | undefined;
  if (!apiKey || !userKey) {
    throw new Error(t('etoroService.credentialsMissing'));
  }
  return { apiKey, userKey };
}

async function callEtoroProxyOrThrow(
  apiKey: string,
  userKey: string,
  extra: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await callEtoroProxy(apiKey, userKey, extra);

  if (error) {
    throw new Error(t('etoroService.proxyError').replace('{error}', error.message || String(error)));
  }
  if (data && typeof data === 'object' && 'error' in (data as Record<string, unknown>) && (data as Record<string, unknown>).error) {
    throw new Error(t('etoroService.proxyError').replace('{error}', String((data as Record<string, unknown>).error)));
  }

  return data ?? {};
}

/**
 * Test eToro API connection
 */
export async function testEtoroConnection(apiKey: string, userKey: string): Promise<boolean> {
  try {
    await callEtoroProxyOrThrow(apiKey, userKey, { endpoint: 'portfolio' });
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
  const data = await callEtoroProxyOrThrow(apiKey, userKey, { endpoint: 'portfolio' });

  const clientPortfolio = (data as { clientPortfolio?: { positions?: EtoroPosition[] } }).clientPortfolio;
  if (clientPortfolio?.positions) return clientPortfolio.positions;
  if (Array.isArray((data as { positions?: EtoroPosition[] }).positions)) {
    return (data as { positions: EtoroPosition[] }).positions;
  }
  return [];
}

/**
 * Löst instrumentID → Symbol/Name über den Proxy auf (/market-data/instruments).
 *
 * Schlägt die Auflösung fehl, wird eine leere Map zurückgegeben statt zu werfen:
 * der Sync selbst bleibt möglich, Positionen bekommen dann einen Fallback-Namen
 * (siehe etoroPositionToPortfolioPosition) statt komplett abzubrechen.
 */
export async function fetchEtoroInstrumentMeta(
  apiKey: string,
  userKey: string,
  instrumentIds: number[],
): Promise<Map<number, EtoroInstrumentMeta>> {
  const uniqueIds = [...new Set(instrumentIds)];
  const meta = new Map<number, EtoroInstrumentMeta>();
  if (uniqueIds.length === 0) return meta;

  const { data, error } = await callEtoroProxy(apiKey, userKey, { endpoint: 'instruments', instrumentIds: uniqueIds });
  if (error) {
    console.error('[etoro-service] Instrument-Auflösung fehlgeschlagen:', error.message);
    return meta;
  }

  // Nacktes Array (Legacy-Testfixture / manche Proxy-Varianten) auf die reale
  // API-Hülle { instrumentDisplayDatas } normalisieren, bevor gegen das Schema
  // aus etoro-api-schemas.ts geprüft wird — das Schema ist die einzige
  // Quelle der Wahrheit für die Feldnamen, kein Duck-Typing mehr.
  const normalized = Array.isArray(data) ? { instrumentDisplayDatas: data } : data;
  const parsed = EtoroInstrumentsResponseSchema.safeParse(normalized);

  if (!parsed.success) {
    // Laut scheitern statt still eine leere Map zu liefern: eine unerwartete
    // API-Antwort soll auffallen (Server-Log), nicht nur zu Platzhalter-Symbolen
    // führen, die wie ein erfolgreicher Sync aussehen (siehe Issue #195).
    console.error('[etoro-service] Unerwartetes Antwort-Schema bei Instrument-Auflösung — Positionen bekommen Platzhalter-Symbole.', {
      issues: parsed.error.issues,
      received: data,
    });
    return meta;
  }

  for (const entry of parsed.data.instrumentDisplayDatas) {
    meta.set(entry.instrumentID, {
      symbol: entry.symbolFull.toUpperCase(),
      name: entry.instrumentDisplayName,
    });
  }

  return meta;
}

/**
 * Wählt den aktuellen Kurs aus einer eToro-Rate: bid zuerst (konservative
 * Bewertung — was eine Long-Position beim Verkauf tatsächlich erzielt),
 * dann lastExecution, dann ask als letzter Fallback.
 */
export function etoroCurrentPrice(rate: { bid?: number; lastExecution?: number; ask?: number }): number | undefined {
  if (typeof rate.bid === 'number' && rate.bid > 0) return rate.bid;
  if (typeof rate.lastExecution === 'number' && rate.lastExecution > 0) return rate.lastExecution;
  if (typeof rate.ask === 'number' && rate.ask > 0) return rate.ask;
  return undefined;
}

/**
 * Holt Live-Kurse je instrumentID (/market-data/instruments/rates) —
 * kollisionsfrei im Gegensatz zu Yahoo-Tickern (siehe quote-service.ts
 * isEtoroPosition: DASH/A/XRP bedeuten dort etwas anderes).
 *
 * Schlägt die Abfrage fehl, wird eine leere Map zurückgegeben statt zu
 * werfen: der Sync bleibt möglich, Positionen behalten dann ihren
 * bisherigen last_price statt abzustürzen.
 */
export async function fetchEtoroRates(
  apiKey: string,
  userKey: string,
  instrumentIds: number[],
): Promise<Map<number, number>> {
  const uniqueIds = [...new Set(instrumentIds)];
  const prices = new Map<number, number>();
  if (uniqueIds.length === 0) return prices;

  const { data, error } = await callEtoroProxy(apiKey, userKey, { endpoint: 'rates', instrumentIds: uniqueIds });
  if (error) {
    console.error('[etoro-service] Kursabfrage fehlgeschlagen:', error.message);
    return prices;
  }

  const parsed = EtoroLiveRatesResponseSchema.safeParse(data);
  if (!parsed.success) {
    console.error('[etoro-service] Unerwartetes Antwort-Schema bei Kursabfrage.', {
      issues: parsed.error.issues,
      received: data,
    });
    return prices;
  }

  for (const rate of parsed.data.rates) {
    const price = etoroCurrentPrice(rate);
    if (price !== undefined) prices.set(rate.instrumentID, price);
  }

  return prices;
}

// -----------------------------------------------------------------------------
// Mapping & Merge
// -----------------------------------------------------------------------------

function etoroMetadata(etoroPosition: EtoroPosition): Record<string, unknown> {
  return {
    etoro_position_id: String(etoroPosition.positionID),
    etoro_instrument_id: etoroPosition.instrumentID,
    is_buy: etoroPosition.isBuy,
    leverage: etoroPosition.leverage,
    open_date: etoroPosition.openDateTime,
    stop_loss_rate: etoroPosition.stopLossRate,
    take_profit_rate: etoroPosition.takeProfitRate,
    // Tatsächlich eingesetztes Kapital (nicht Menge × Kurs — das wäre bei
    // Hebel die Exposure). Speist getPortfolioSummary/positionCostBasis.
    invested_amount: etoroPosition.amount,
  };
}

function etoroPositionToPortfolioPosition(
  etoroPosition: EtoroPosition,
  portfolioId: string,
  meta: EtoroInstrumentMeta | undefined,
  currentPrice: number | undefined,
): Partial<PortfolioPosition> {
  // Ohne aufgelöste Metadaten (Instrument-Lookup fehlgeschlagen) lieber ein
  // erkennbares Platzhalter-Symbol als einen Absturz auf undefined.toUpperCase().
  const symbol = meta?.symbol || `ETORO-${etoroPosition.instrumentID}`;

  return {
    portfolio_id: portfolioId,
    symbol,
    name: meta?.name || symbol,
    // Short-Positionen liefern negative Units — wir führen Bestände als Stückzahl
    quantity: Math.abs(etoroPosition.units),
    entry_price: etoroPosition.openRate,
    currency: 'USD', // eToro führt Konten in USD
    exchange: 'ETORO',
    last_price: currentPrice,
    last_price_at: currentPrice !== undefined ? new Date().toISOString() : undefined,
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
 * verwalten, die er selbst importiert hat. Die Portfolio-Antwort von eToro
 * enthält ausschließlich aktuell offene Positionen — alles, was lokal als
 * eToro-Position markiert ist, aber hier fehlt, wurde geschlossen.
 */
export function mergeEtoroPositions(
  existing: PortfolioPosition[],
  incoming: EtoroPosition[],
  instrumentMeta: Map<number, EtoroInstrumentMeta>,
  rates: Map<number, number>,
): EtoroMergePlan {
  const existingByEtoroId = new Map<string, PortfolioPosition>();
  for (const position of existing) {
    const etoroId = position.metadata?.etoro_position_id;
    if (etoroId != null) existingByEtoroId.set(String(etoroId), position);
  }

  const seen = new Set<string>();
  const toCreate: EtoroPosition[] = [];
  const toUpdate: EtoroMergePlan['toUpdate'] = [];

  for (const position of incoming) {
    const etoroId = String(position.positionID);
    seen.add(etoroId);

    const match = existingByEtoroId.get(etoroId);
    if (!match) {
      toCreate.push(position);
    } else {
      const meta = instrumentMeta.get(position.instrumentID);
      // Live-Kurs von eToro, falls verfügbar — sonst wird ein evtl.
      // vergifteter last_price verworfen (Yahoo hatte eToro-Positionen über
      // Symbol-Kollisionen falsche Kurse zugewiesen, z.B. DASH→DoorDash).
      // Ohne echten Kurs ist der Einstiegspreis ehrlicher als ein fremder
      // Ticker oder ein veralteter Wert.
      const price = rates.get(position.instrumentID);
      toUpdate.push({
        id: match.id,
        updates: {
          quantity: Math.abs(position.units),
          entry_price: position.openRate,
          // Auch Symbol heilen: ein früherer Sync ohne Instrument-Auflösung
          // hat Platzhalter (ETORO-<id>) hinterlassen.
          symbol: meta?.symbol || match.symbol,
          name: meta?.name || meta?.symbol || match.name,
          last_price: price,
          last_price_at: price !== undefined ? new Date().toISOString() : undefined,
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

  const instrumentIds = etoroPositions.map((p) => p.instrumentID);
  const instrumentMeta = await fetchEtoroInstrumentMeta(apiKey, userKey, instrumentIds);
  const rates = await fetchEtoroRates(apiKey, userKey, instrumentIds);

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

  for (const etoroPosition of etoroPositions) {
    try {
      await createPosition(
        etoroPositionToPortfolioPosition(
          etoroPosition,
          portfolio.id,
          instrumentMeta.get(etoroPosition.instrumentID),
          rates.get(etoroPosition.instrumentID),
        ),
      );
    } catch (error) {
      console.error(
        `[etoro-service] Failed to import position ${etoroPosition.instrumentID}:`,
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
  const instrumentIds = incoming.map((p) => p.instrumentID);
  const instrumentMeta = await fetchEtoroInstrumentMeta(apiKey, userKey, instrumentIds);
  const rates = await fetchEtoroRates(apiKey, userKey, instrumentIds);
  const existing = await getPositions(portfolioId);

  const { toCreate, toUpdate, toDeleteIds } = mergeEtoroPositions(existing, incoming, instrumentMeta, rates);

  for (const etoroPosition of toCreate) {
    await createPosition(
      etoroPositionToPortfolioPosition(
        etoroPosition,
        portfolioId,
        instrumentMeta.get(etoroPosition.instrumentID),
        rates.get(etoroPosition.instrumentID),
      ),
    );
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
