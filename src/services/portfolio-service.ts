import { t } from '../i18n/serviceT';
import type { Portfolio, PortfolioPosition, PortfolioSummary, UnconvertedPosition } from '../types';
import { isSameCurrency } from '@/lib/portfolio-currency';
import { getCurrentUserId } from './auth-service';
import {
  deleteLocalFinanceItem,
  readLocalFinanceList,
  updateLocalFinanceItem,
  upsertLocalFinanceItem,
  writeLocalFinanceList,
} from './local-finance-store';

async function localUserId(): Promise<string> {
  return (await getCurrentUserId()) || 'local';
}

export async function getPortfolios(): Promise<Portfolio[]> {
  const portfolios = await readLocalFinanceList<Portfolio>('portfolios');
  return portfolios.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

export async function getPortfolioById(id: string): Promise<Portfolio | null> {
  const portfolios = await getPortfolios();
  return portfolios.find((portfolio) => portfolio.id === id) || null;
}

export async function getActivePortfolio(): Promise<Portfolio | null> {
  const portfolios = await getPortfolios();
  return portfolios.find((portfolio) => portfolio.is_active) || portfolios[0] || null;
}

export async function createPortfolio(portfolioData: Partial<Portfolio>): Promise<Portfolio> {
  const portfolios = await getPortfolios();
  const shouldBeActive = portfolioData.is_active ?? portfolios.length === 0;

  if (shouldBeActive) {
    await writeLocalFinanceList('portfolios', portfolios.map((portfolio) => ({ ...portfolio, is_active: false })));
  }

  const now = new Date().toISOString();
  return upsertLocalFinanceItem<Portfolio>('portfolios', {
    id: portfolioData.id || crypto.randomUUID(),
    user_id: await localUserId(),
    name: portfolioData.name || t('portfolio.newPortfolioName'),
    type: portfolioData.type || 'manual',
    provider_config: portfolioData.provider_config || {},
    currency: portfolioData.currency || 'EUR',
    is_active: shouldBeActive,
    created_at: portfolioData.created_at || now,
    updated_at: portfolioData.updated_at || now,
  });
}

export async function updatePortfolio(id: string, updates: Partial<Portfolio>): Promise<Portfolio> {
  return updateLocalFinanceItem<Portfolio>('portfolios', id, updates);
}

export async function setActivePortfolio(id: string): Promise<void> {
  const portfolios = await getPortfolios();
  if (!portfolios.some((portfolio) => portfolio.id === id)) throw new Error(t('portfolio.notFound'));
  await writeLocalFinanceList('portfolios', portfolios.map((portfolio) => ({
    ...portfolio,
    is_active: portfolio.id === id,
    updated_at: portfolio.id === id ? new Date().toISOString() : portfolio.updated_at,
  })));
}

export async function deletePortfolio(id: string): Promise<void> {
  await deleteLocalFinanceItem<Portfolio>('portfolios', id);
  const positions = await readLocalFinanceList<PortfolioPosition>('portfolioPositions');
  await writeLocalFinanceList('portfolioPositions', positions.filter((position) => position.portfolio_id !== id));

  const remaining = await getPortfolios();
  if (remaining.length > 0 && !remaining.some((portfolio) => portfolio.is_active)) {
    await setActivePortfolio(remaining[0].id);
  }
}

export async function getPositions(portfolioId: string): Promise<PortfolioPosition[]> {
  const portfolio = await getPortfolioById(portfolioId);
  if (!portfolio) throw new Error(t('portfolio.notFound'));

  const positions = await readLocalFinanceList<PortfolioPosition>('portfolioPositions');
  return positions
    .filter((position) => position.portfolio_id === portfolioId)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

export async function getPositionById(id: string): Promise<PortfolioPosition | null> {
  const positions = await readLocalFinanceList<PortfolioPosition>('portfolioPositions');
  return positions.find((position) => position.id === id) || null;
}

export async function createPosition(position: Partial<PortfolioPosition>): Promise<PortfolioPosition> {
  const portfolio = await getPortfolioById(position.portfolio_id!);
  if (!portfolio) throw new Error(t('portfolio.notFound'));

  const now = new Date().toISOString();
  return upsertLocalFinanceItem<PortfolioPosition>('portfolioPositions', {
    id: position.id || crypto.randomUUID(),
    portfolio_id: position.portfolio_id!,
    symbol: position.symbol?.toUpperCase() || '',
    name: position.name || position.symbol || '',
    quantity: Number(position.quantity) || 0,
    entry_price: Number(position.entry_price) || 0,
    currency: position.currency || portfolio.currency || 'EUR',
    exchange: position.exchange,
    metadata: position.metadata || {},
    last_price: position.last_price,
    last_price_at: position.last_price_at,
    created_at: position.created_at || now,
    updated_at: position.updated_at || now,
  });
}

export async function updatePosition(id: string, updates: Partial<PortfolioPosition>): Promise<PortfolioPosition> {
  const normalized: Partial<PortfolioPosition> = {
    ...updates,
    symbol: updates.symbol?.toUpperCase(),
  };
  return updateLocalFinanceItem<PortfolioPosition>('portfolioPositions', id, normalized);
}

export async function updatePositionPrice(id: string, price: number, timestamp?: string): Promise<void> {
  await updateLocalFinanceItem<PortfolioPosition>('portfolioPositions', id, {
    last_price: price,
    last_price_at: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
  });
}

export async function deletePosition(id: string): Promise<void> {
  await deleteLocalFinanceItem<PortfolioPosition>('portfolioPositions', id);
}

export async function batchUpdatePrices(updates: Array<{ id: string; price: number }>): Promise<void> {
  const nowIso = new Date().toISOString();
  for (const update of updates) {
    await updateLocalFinanceItem<PortfolioPosition>('portfolioPositions', update.id, {
      last_price: update.price,
      last_price_at: nowIso,
    });
  }
}

/**
 * Investiertes Kapital einer Position. eToro-Positionen speichern das
 * tatsächlich eingesetzte Kapital (`invested_amount`, aus dem `amount`-Feld
 * der Portfolio-API) — bei Hebel ist Menge × Einstiegskurs die Exposure,
 * nicht das eingesetzte Kapital, und würde "Investiert" künstlich aufblähen.
 */
function positionCostBasis(position: PortfolioPosition): number {
  const investedAmount = position.metadata?.invested_amount;
  if (typeof investedAmount === 'number' && Number.isFinite(investedAmount)) {
    return investedAmount;
  }
  return position.quantity * position.entry_price;
}

export async function getPortfolioSummary(portfolioId: string): Promise<PortfolioSummary> {
  const portfolio = await getPortfolioById(portfolioId);
  if (!portfolio) throw new Error(t('portfolio.notFound'));

  const positions = await getPositions(portfolioId);
  let total_value = 0;
  let total_cost = 0;
  const unconverted_positions: UnconvertedPosition[] = [];

  for (const position of positions) {
    const currentPrice = position.last_price || position.entry_price;
    const marketValue = position.quantity * currentPrice;

    // VE-1 (docs/architecture/currency-eur-only.md): Es gibt keine Kursquelle
    // und keine Umrechnung. Eine Position in einer anderen Währung als der
    // Depotwährung darf deshalb NICHT addiert werden — 1:1 summiert ergäbe das
    // beim damaligen EUR/USD-Kurs rund 8 % Fehler, und zwar lautlos. Sie wird
    // stattdessen benannt (F-DEBT-2, T1.11, WP 7.7).
    if (!isSameCurrency(position.currency, portfolio.currency)) {
      unconverted_positions.push({
        id: position.id,
        symbol: position.symbol,
        name: position.name,
        currency: position.currency,
        value: marketValue,
      });
      continue;
    }

    total_value += marketValue;
    total_cost += positionCostBasis(position);
  }

  const unrealized_gain_loss = total_value - total_cost;
  const unrealized_gain_loss_percent = total_cost > 0 ? (unrealized_gain_loss / total_cost) * 100 : 0;

  return {
    total_value,
    total_cost,
    unrealized_gain_loss,
    unrealized_gain_loss_percent,
    positions_count: positions.length,
    currency: portfolio.currency,
    unconverted_positions,
  };
}

export async function initializeDemoPortfolio(): Promise<Portfolio> {
  const existing = await getPortfolios();
  if (existing.length > 0) return existing[0];

  const demoPortfolio = await createPortfolio({
    name: t('portfolio.demoPortfolioName'),
    type: 'demo',
    currency: 'EUR',
    is_active: true,
  });

  const demoPositions = [
    { portfolio_id: demoPortfolio.id, symbol: 'SAP', name: 'SAP SE', quantity: 10, entry_price: 145.50, currency: 'EUR', exchange: 'XETRA' },
    { portfolio_id: demoPortfolio.id, symbol: 'VOW3', name: 'Volkswagen AG', quantity: 20, entry_price: 92.80, currency: 'EUR', exchange: 'XETRA' },
    { portfolio_id: demoPortfolio.id, symbol: 'IE00B4L5Y983', name: 'iShares Core MSCI World', quantity: 15, entry_price: 68.40, currency: 'EUR', exchange: 'XETRA' },
    { portfolio_id: demoPortfolio.id, symbol: 'AAPL', name: 'Apple Inc.', quantity: 5, entry_price: 178.50, currency: 'USD', exchange: 'NASDAQ' },
    { portfolio_id: demoPortfolio.id, symbol: 'MSFT', name: 'Microsoft Corporation', quantity: 8, entry_price: 375.20, currency: 'USD', exchange: 'NASDAQ' },
  ];

  for (const position of demoPositions) {
    await createPosition(position);
  }

  return demoPortfolio;
}

export async function hasPortfolios(): Promise<boolean> {
  const portfolios = await getPortfolios();
  return portfolios.length > 0;
}
