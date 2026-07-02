import type { Portfolio, PortfolioPosition } from '../types';
import { createPortfolio, createPosition, getPortfolioById } from './portfolio-service';
import { localEncryption } from './local-crypto';

// -----------------------------------------------------------------------------
// eToro API Types
// -----------------------------------------------------------------------------

interface EtoroPosition {
  PositionID: string;
  InstrumentID: string;
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

// -----------------------------------------------------------------------------
// eToro API Functions
// -----------------------------------------------------------------------------

/**
 * Test eToro API connection
 */
export async function testEtoroConnection(apiKey: string, userKey: string): Promise<boolean> {
  try {
    const url = 'https://public-api.etoro.com/api/v1/trading/info/real/portfolio';
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'x-user-key': userKey,
        'x-request-id': crypto.randomUUID(),
        'Accept': 'application/json',
      },
    });

    return response.ok;
  } catch (error) {
    console.error('[etoro-service] Connection test failed:', error);
    return false;
  }
}

/**
 * Fetch portfolio from eToro API
 */
export async function fetchEtoroPortfolio(
  apiKey: string,
  userKey: string
): Promise<EtoroPosition[]> {
  try {
    const url = 'https://public-api.etoro.com/api/v1/trading/info/real/portfolio';
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'x-user-key': userKey,
        'x-request-id': crypto.randomUUID(),
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`eToro API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Parse positions from eToro API response
    if (data.clientPortfolio && data.clientPortfolio.positions) {
      return data.clientPortfolio.positions;
    }
    
    return [];
  } catch (error) {
    console.error('[etoro-service] Failed to fetch portfolio:', error);
    throw error;
  }
}

/**
 * Convert eToro position to PortfolioPosition
 */
function etoroPositionToPortfolioPosition(
  etoroPosition: EtoroPosition,
  portfolioId: string
): Partial<PortfolioPosition> {
  // Determine if this is a buy (long) or sell (short) position
  const isBuy = etoroPosition.IsBuy;
  const quantity = Math.abs(etoroPosition.Units);
  
  // For short positions, we use the open rate as entry price
  // For long positions, we use the open rate as entry price
  const entryPrice = etoroPosition.OpenRate;

  return {
    portfolio_id: portfolioId,
    symbol: etoroPosition.InstrumentSymbol.toUpperCase(),
    name: etoroPosition.InstrumentDisplayName || etoroPosition.InstrumentSymbol,
    quantity: quantity,
    entry_price: entryPrice,
    currency: 'USD', // eToro primarily uses USD
    exchange: 'ETORO',
    metadata: {
      etoro_position_id: etoroPosition.PositionID,
      etoro_instrument_id: etoroPosition.InstrumentID,
      is_buy: isBuy,
      leverage: etoroPosition.Leverage,
      open_date: etoroPosition.OpenDate,
      is_closed: etoroPosition.Closed,
      close_rate: etoroPosition.CloseRate,
      close_date: etoroPosition.CloseDate,
      stop_loss_rate: etoroPosition.StopLossRate,
      take_profit_rate: etoroPosition.TakeProfitRate,
      copy_trading_parent_id: etoroPosition.CopyTradingParentID,
      profit: etoroPosition.Profit,
    },
  };
}

/**
 * Connect eToro account and create portfolio
 */
export async function connectEtoroAccount(
  username: string,
  apiKey: string,
  userKey: string
): Promise<Portfolio> {
  // Broker-Credentials sind deutlich sensibler als die übrigen Finanzdaten
  // (voller Zugriff aufs Handelskonto). Sie dürfen nur gespeichert werden, wenn
  // die lokale Verschlüsselung aktiv und entsperrt ist — sonst lägen sie im
  // Klartext in IndexedDB und in unverschlüsselten Backups (T1.10 / F-DEBT-1).
  if (!localEncryption.isUnlocked()) {
    throw new Error(
      'Bitte richte zuerst die lokale Verschlüsselung ein und entsperre sie. ' +
        'eToro-Zugangsdaten werden nur verschlüsselt gespeichert.',
    );
  }

  // Test connection first
  const connected = await testEtoroConnection(apiKey, userKey);
  if (!connected) {
    throw new Error('Could not connect to eToro. Please check your credentials.');
  }

  // Fetch portfolio from eToro
  const etoroPositions = await fetchEtoroPortfolio(apiKey, userKey);

  if (!etoroPositions || etoroPositions.length === 0) {
    throw new Error('No positions found in eToro portfolio.');
  }

  // Create a new eToro portfolio
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

  // Import positions
  for (const etoroPosition of etoroPositions) {
    try {
      const positionData = etoroPositionToPortfolioPosition(etoroPosition, portfolio.id);
      await createPosition(positionData);
    } catch (error) {
      console.error(
        `[etoro-service] Failed to import position ${etoroPosition.InstrumentSymbol}:`,
        error
      );
      // Continue with other positions even if one fails
    }
  }

  return portfolio;
}

/**
 * eToro-Anbindung ist eine VORSCHAU (Issue #107): gelesene Positionen werden
 * NICHT dauerhaft im lokalen Store persistiert — sie gehen bei einem Reload
 * verloren. Für dauerhafte Positionen die manuelle Erfassung nutzen.
 */
export const ETORO_PREVIEW_NOTICE =
  'Vorschau: eToro-Positionen werden nur angezeigt, aber nicht dauerhaft gespeichert (gehen bei Reload verloren). Für dauerhafte Positionen nutze „Position hinzufügen".';

/**
 * Sync existing eToro portfolio with latest data.
 *
 * ⚠️ Vorschau (nicht persistent): liest die aktuellen Positionen, schreibt sie
 * aber bewusst NICHT in den lokalen Store (siehe {@link ETORO_PREVIEW_NOTICE}).
 * Bis ein sicherer Persistenz-/Merge-Pfad steht, bleibt das eine reine Anzeige.
 */
export async function syncEtoroPortfolio(portfolioId: string): Promise<void> {
  const portfolio = await getPortfolioById(portfolioId);
  
  if (!portfolio || portfolio.type !== 'etoro') {
    throw new Error('Portfolio is not an eToro portfolio');
  }

  const username = portfolio.provider_config?.username as string | undefined;
  const apiKey = portfolio.provider_config?.apiKey as string | undefined;
  const userKey = portfolio.provider_config?.userKey as string | undefined;

  if (!username || !apiKey || !userKey) {
    throw new Error('eToro credentials not found in portfolio config');
  }

  // Fetch latest positions from eToro
  const etoroPositions = await fetchEtoroPortfolio(apiKey, userKey);

  // Note: In a real implementation, you would:
  // 1. Compare existing positions with new ones
  // 2. Update changed positions
  // 3. Remove closed positions (optional)
  // 4. Add new positions
  
  // For simplicity, we'll just log the sync action without account identifiers.
  console.log('[etoro-service] Positions synced', { count: etoroPositions.length });
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

/**
 * Update eToro credentials for a portfolio
 */
export async function updateEtoroCredentials(
  _portfolioId: string,
  _username: string,
  _apiKey: string
): Promise<void> {
  // This would be implemented in portfolio-service
  // For now, it's a placeholder
  console.log('[etoro-service] Updating credentials for portfolio');
}