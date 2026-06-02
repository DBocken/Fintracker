"use client";

import type { Portfolio, PortfolioPosition, PortfolioSummary } from '../types';
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
    name: portfolioData.name || 'Neues Portfolio',
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
  if (!portfolios.some((portfolio) => portfolio.id === id)) throw new Error('Portfolio not found');
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
  if (!portfolio) throw new Error('Portfolio not found');

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
  if (!portfolio) throw new Error('Portfolio not found');

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

export async function getPortfolioSummary(portfolioId: string): Promise<PortfolioSummary> {
  const portfolio = await getPortfolioById(portfolioId);
  if (!portfolio) throw new Error('Portfolio not found');

  const positions = await getPositions(portfolioId);
  let total_value = 0;
  let total_cost = 0;

  for (const position of positions) {
    const currentPrice = position.last_price || position.entry_price;
    total_value += position.quantity * currentPrice;
    total_cost += position.quantity * position.entry_price;
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
  };
}

export async function initializeDemoPortfolio(): Promise<Portfolio> {
  const existing = await getPortfolios();
  if (existing.length > 0) return existing[0];

  const demoPortfolio = await createPortfolio({
    name: 'Demo Portfolio',
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
