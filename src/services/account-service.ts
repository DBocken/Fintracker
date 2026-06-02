"use client";

import { supabase } from '../integrations/supabase/client';
import type { Account, AccountType } from '../types';
import { getCurrentUserId, requireUserId } from './auth-service';

// Account type labels for UI
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Girokonto',
  credit_card: 'Kreditkarte',
  savings: 'Tagesgeld/Sparkonto',
  wallet: 'Wallet (PayPal, Revolut, etc.)',
  other: 'Sonstiges',
};

// Default icons per account type
export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  checking: '🏦',
  credit_card: '💳',
  savings: '🐷',
  wallet: '📱',
  other: '💰',
};

// Default colors per account type
export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  checking: '#3b82f6', // blue
  credit_card: '#8b5cf6', // purple
  savings: '#10b981', // green
  wallet: '#f59e0b', // amber
  other: '#6b7280', // gray
};

// Free tier limit
export const FREE_ACCOUNT_LIMIT = 3;

/**
 * Get all accounts for current user
 */
export async function getAccounts(): Promise<Account[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', uid)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as Account[];
}

/**
 * Get a single account by ID
 */
export async function getAccountById(id: string): Promise<Account | null> {
  const uid = await requireUserId();

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .eq('user_id', uid)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data as Account;
}

/**
 * Create a new account
 */
export async function createAccount(account: Partial<Account>): Promise<Account> {
  const uid = await requireUserId();

  // Check account limit for free users (Premium check would go here)
  const existingAccounts = await getAccounts();
  if (existingAccounts.length >= FREE_ACCOUNT_LIMIT) {
    throw new Error(`Maximale Anzahl von ${FREE_ACCOUNT_LIMIT} Konten erreicht. Upgrade auf Premium für unbegrenzte Konten.`);
  }

  const type = account.type || 'checking';
  
  const payload = {
    user_id: uid,
    name: account.name || 'Neues Konto',
    type,
    currency: account.currency || 'EUR',
    description: account.description || '',
    color: account.color || ACCOUNT_TYPE_COLORS[type],
    icon: account.icon || ACCOUNT_TYPE_ICONS[type],
    is_budget_pool_member: account.is_budget_pool_member ?? true,
    order_index: account.order_index ?? existingAccounts.length,
    statement_close_day: account.statement_close_day || null,
    due_day: account.due_day || null,
    autopay_account_id: account.autopay_account_id || null,
    // GoCardless fields
    gocardless_account_id: account.gocardless_account_id || null,
    gocardless_requisition_id: account.gocardless_requisition_id || null,
    gocardless_institution_id: account.gocardless_institution_id || null,
    gocardless_institution_name: account.gocardless_institution_name || null,
    last_sync_at: account.last_sync_at || null,
    sync_enabled: account.sync_enabled ?? false,
    bank_connection_id: account.bank_connection_id || null,
  };

  const { data, error } = await supabase
    .from('accounts')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as Account;
}

/**
 * Update an existing account
 */
export async function updateAccount(account: Partial<Account> & { id: string }): Promise<Account> {
  const uid = await requireUserId();

  const payload: any = {
    updated_at: new Date().toISOString(),
  };

  // Only include fields that are provided (explicit null values are allowed)
  if (account.name !== undefined) payload.name = account.name;
  if (account.type !== undefined) payload.type = account.type;
  if (account.currency !== undefined) payload.currency = account.currency;
  if (account.description !== undefined) payload.description = account.description;
  if (account.color !== undefined) payload.color = account.color;
  if (account.icon !== undefined) payload.icon = account.icon;
  if (account.is_budget_pool_member !== undefined) payload.is_budget_pool_member = account.is_budget_pool_member;
  if (account.order_index !== undefined) payload.order_index = account.order_index;
  if (account.statement_close_day !== undefined) payload.statement_close_day = account.statement_close_day;
  if (account.due_day !== undefined) payload.due_day = account.due_day;
  if (account.autopay_account_id !== undefined) payload.autopay_account_id = account.autopay_account_id;
  
  // GoCardless fields
  if (account.gocardless_account_id !== undefined) payload.gocardless_account_id = account.gocardless_account_id;
  if (account.gocardless_requisition_id !== undefined) payload.gocardless_requisition_id = account.gocardless_requisition_id;
  if (account.gocardless_institution_id !== undefined) payload.gocardless_institution_id = account.gocardless_institution_id;
  if (account.gocardless_institution_name !== undefined) payload.gocardless_institution_name = account.gocardless_institution_name;
  if (account.last_sync_at !== undefined) payload.last_sync_at = account.last_sync_at;
  if (account.sync_enabled !== undefined) payload.sync_enabled = account.sync_enabled;
  if (account.bank_connection_id !== undefined) payload.bank_connection_id = account.bank_connection_id;

  const { data, error } = await supabase
    .from('accounts')
    .update(payload)
    .eq('id', account.id)
    .eq('user_id', uid)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as Account;
}

/**
 * Delete an account
 */
export async function deleteAccount(id: string): Promise<void> {
  const uid = await requireUserId();

  // Check if account has transactions
  // For now, we allow deletion - transactions will have null account_id
  // In a real app, you might want to reassign or warn the user

  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', uid);

  if (error) throw new Error(error.message);
}

/**
 * Get or create a default checking account for user
 */
export async function getOrCreateDefaultAccount(): Promise<Account> {
  const accounts = await getAccounts();
  
  // Return first checking account if exists
  const checkingAccount = accounts.find(a => a.type === 'checking');
  if (checkingAccount) return checkingAccount;

  // Return any account if exists
  if (accounts.length > 0) return accounts[0];

  // Create default account
  return await createAccount({
    name: 'Girokonto',
    type: 'checking',
    description: 'Mein Hauptkonto',
    is_budget_pool_member: true,
  });
}

/**
 * Check if user can create more accounts (free tier limit)
 */
export async function canCreateAccount(): Promise<{ allowed: boolean; current: number; limit: number }> {
  const accounts = await getAccounts();
  return {
    allowed: accounts.length < FREE_ACCOUNT_LIMIT,
    current: accounts.length,
    limit: FREE_ACCOUNT_LIMIT,
  };
}

/**
 * Get accounts connected to GoCardless
 */
export async function getGoCardlessAccounts(): Promise<Account[]> {
  const accounts = await getAccounts();
  return accounts.filter(acc => acc.gocardless_account_id);
}

/**
 * Get account by GoCardless account ID
 */
export async function getAccountByGoCardlessId(gocardlessAccountId: string): Promise<Account | null> {
  const uid = await getCurrentUserId();
  if (!uid) return null;

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', uid)
    .eq('gocardless_account_id', gocardlessAccountId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data as Account;
}

/**
 * Format sync status for display
 */
export function formatSyncStatus(account: Account): string {
  if (!account.gocardless_account_id) {
    return 'Nicht verbunden';
  }

  if (!account.sync_enabled) {
    return 'Synchronisation deaktiviert';
  }

  if (!account.last_sync_at) {
    return 'Noch nie synchronisiert';
  }

  const lastSync = new Date(account.last_sync_at);
  const now = new Date();
  const diffMs = now.getTime() - lastSync.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Gerade eben';
  if (diffMins < 60) return `Vor ${diffMins} Min.`;
  if (diffHours < 24) return `Vor ${diffHours} Std.`;
  if (diffDays < 7) return `Vor ${diffDays} Tagen`;
  
  return lastSync.toLocaleDateString('de-DE');
}

// Re-export Account type for convenience
export type { Account } from '../types';