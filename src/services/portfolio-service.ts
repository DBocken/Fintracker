"use client";

import { supabase } from '../integrations/supabase/client';
import type { Portfolio, PortfolioPosition, PortfolioSummary } from '../types';
import { requireUserId } from './auth-service';

// -----------------------------------------------------------------------------
// Portfolio CRUD Operations (Supabase)
// -----------------------------------------------------------------------------

export async function getPortfolios(): Promise<Portfolio[]> {
  const uid = await requireUserId();

  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as Portfolio[];
}

export async function getPortfolioById(id: string): Promise<Portfolio | null> {
  const uid = await requireUserId();

  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('id', id)
    .eq('user_id', uid)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }

  return data as Portfolio;
}

export async function getActivePortfolio(): Promise<Portfolio | null> {
  const uid = await requireUserId();

  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', uid)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }

  return data as Portfolio;
}

export async function createPortfolio(portfolioData: Partial<Portfolio>): Promise<Portfolio> {
  const uid = await requireUserId();

  const payload = {
    user_id: uid,
    name: portfolioData.name || 'Neues Portfolio',
    type: portfolioData.type || 'manual',
    provider_config: portfolioData.provider_config || {},
    currency: portfolioData.currency || 'EUR',
    is_active: portfolioData.is_active ?? false,
  };

  const { data, error } = await supabase
    .from('portfolios')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as Portfolio;
}

export async function updatePortfolio(id: string, updates: Partial<Portfolio>): Promise<Portfolio> {
  const uid = await requireUserId();

  const { data, error } = await supabase
    .from('portfolios')
    .update({
      name: updates.name,
      type: updates.type,
      provider_config: updates.provider_config,
      currency: updates.currency,
      is_active: updates.is_active,
    })
    .eq('id', id)
    .eq('user_id', uid)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as Portfolio;
}

export async function setActivePortfolio(id: string): Promise<void> {
  const uid = await requireUserId();

  const { error: deactivateError } = await supabase
    .from('portfolios')
    .update({ is_active: false })
    .eq('user_id', uid);

  if (deactivateError) throw new Error(deactivateError.message);

  const { error: activateError } = await supabase
    .from('portfolios')
    .update({ is_active: true })
    .eq('id', id)
    .eq('user_id', uid);

  if (activateError) throw new Error(activateError.message);
}

export async function deletePortfolio(id: string): Promise<void> {
  const uid = await requireUserId();

  const { error } = await supabase
    .from('portfolios')
    .delete()
    .eq('id', id)
    .eq('user_id', uid);

  if (error) throw new Error(error.message);
}

// -----------------------------------------------------------------------------
// Position CRUD Operations (Supabase - Financial data)
// -----------------------------------------------------------------------------

export async function getPositions(portfolioId: string): Promise<PortfolioPosition[]> {
  // Verify portfolio exists
  const portfolio = await getPortfolioById(portfolioId);
  if (!portfolio) throw new Error('Portfolio not found');

  const { data, error } = await supabase
    .from('portfolio_positions')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as PortfolioPosition[];
}

export async function getPositionById(id: string): Promise<PortfolioPosition | null> {
  const { data, error } = await supabase
    .from('portfolio_positions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }

  return data as PortfolioPosition;
}

export async function createPosition(position: Partial<PortfolioPosition>): Promise<PortfolioPosition> {
  // Verify portfolio exists
  const portfolio = await getPortfolioById(position.portfolio_id!);
  if (!portfolio) throw new Error('Portfolio not found');

  const payload = {
    portfolio_id: position.portfolio_id,
    symbol: position.symbol?.toUpperCase() || '',
    name: position.name || position.symbol,
    quantity: position.quantity || 0,
    entry_price: position.entry_price || 0,
    currency: position.currency || portfolio.currency || 'EUR',
    exchange: position.exchange,
    metadata: position.metadata || {},
    last_price: position.last_price,
    last_price_at: position.last_price_at,
  };

  const { data, error } = await supabase
    .from('portfolio_positions')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as PortfolioPosition;
}

export async function updatePosition(id: string, updates: Partial<PortfolioPosition>): Promise<PortfolioPosition> {
  const payload: any = {
    symbol: updates.symbol?.toUpperCase(),
    name: updates.name,
    quantity: updates.quantity,
    entry_price: updates.entry_price,
    currency: updates.currency,
    exchange: updates.exchange,
    metadata: updates.metadata,
  };

  const { data, error } = await supabase
    .from('portfolio_positions')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as PortfolioPosition;
}

export async function updatePositionPrice(id: string, price: number, timestamp?: string): Promise<void> {
  const { error } = await supabase
    .from('portfolio_positions')
    .update({
      last_price: price,
      last_price_at: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deletePosition(id: string): Promise<void> {
  const { error } = await supabase
    .from('portfolio_positions')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function batchUpdatePrices(updates: Array<{ id: string; price: number }>): Promise<void> {
  const nowIso = new Date().toISOString();

  for (const u of updates) {
    const { error } = await supabase
      .from('portfolio_positions')
      .update({ last_price: u.price, last_price_at: nowIso })
      .eq('id', u.id);

    if (error) throw new Error(error.message);
  }
}

// -----------------------------------------------------------------------------
// Portfolio Summary & Calculations (Client-side)
// -----------------------------------------------------------------------------

export async function getPortfolioSummary(portfolioId: string): Promise<PortfolioSummary> {
  const portfolio = await getPortfolioById(portfolioId);
  if (!portfolio) {
    throw new Error('Portfolio not found');
  }

  const positions = await getPositions(portfolioId);

  let total_value = 0;
  let total_cost = 0;

  for (const position of positions) {
    const current_price = position.last_price || position.entry_price;
    const position_value = position.quantity * current_price;
    const position_cost = position.quantity * position.entry_price;

    total_value += position_value;
    total_cost += position_cost;
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

// -----------------------------------------------------------------------------
// Demo Portfolio Initialization
// -----------------------------------------------------------------------------

/**
 * Create a demo portfolio with example positions if none exists
 */
export async function initializeDemoPortfolio(): Promise<Portfolio> {
  const existing = await getPortfolios();
  if (existing.length > 0) {
    return existing[0];
  }

  // Create demo portfolio
  const demoPortfolio = await createPortfolio({
    name: 'Demo Portfolio',
    type: 'demo',
    currency: 'EUR',
    is_active: true,
  });

  // Create demo positions with realistic German stocks/ETFs
  const demoPositions = [
    {
      portfolio_id: demoPortfolio.id,
      symbol: 'SAP',
      name: 'SAP SE',
      quantity: 10,
      entry_price: 145.50,
      currency: 'EUR',
      exchange: 'XETRA',
    },
    {
      portfolio_id: demoPortfolio.id,
      symbol: 'VOW3',
      name: 'Volkswagen AG',
      quantity: 20,
      entry_price: 92.80,
      currency: 'EUR',
      exchange: 'XETRA',
    },
    {
      portfolio_id: demoPortfolio.id,
      symbol: 'IE00B4L5Y983',
      name: 'iShares Core MSCI World',
      quantity: 15,
      entry_price: 68.40,
      currency: 'EUR',
      exchange: 'XETRA',
    },
    {
      portfolio_id: demoPortfolio.id,
      symbol: 'AAPL',
      name: 'Apple Inc.',
      quantity: 5,
      entry_price: 178.50,
      currency: 'USD',
      exchange: 'NASDAQ',
    },
    {
      portfolio_id: demoPortfolio.id,
      symbol: 'MSFT',
      name: 'Microsoft Corporation',
      quantity: 8,
      entry_price: 375.20,
      currency: 'USD',
      exchange: 'NASDAQ',
    },
  ];

  for (const position of demoPositions) {
    await createPosition(position);
  }

  return demoPortfolio;
}

/**
 * Check if user has any portfolios
 */
export async function hasPortfolios(): Promise<boolean> {
  const portfolios = await getPortfolios();
  return portfolios.length > 0;
}