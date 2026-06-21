import { supabase } from '../integrations/supabase/client';
import type { UserSettings } from '../types';
import { requireUserId } from './auth-service';

// -----------------------------------------------------------------------------
// User Settings CRUD Operations
// -----------------------------------------------------------------------------

/**
 * Get user settings for the current user
 */
export async function getUserSettings(): Promise<UserSettings> {
  const uid = await requireUserId();

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', uid)
    .single();

  if (error) {
    // If settings don't exist, create default settings
    if (error.code === 'PGRST116') {
      return createDefaultSettings(uid);
    }
    throw new Error(error.message);
  }

  return data as UserSettings;
}

/**
 * Create default settings for a user
 */
async function createDefaultSettings(uid: string): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .insert({
      user_id: uid,
      auto_confirm_mapping: false,
      retention_months: 36,
      default_currency: 'EUR',
      enable_subcategories: true,
      theme: 'system',
      kpi_prefs: {
        order: ['net_cashflow', 'savings_rate', 'transactions_count'],
        active: ['net_cashflow', 'savings_rate', 'transactions_count'],
      },
      preferred_market_provider: 'yahoo',
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as UserSettings;
}

/**
 * Update user settings
 */
export async function updateUserSettings(
  updates: Partial<UserSettings>
): Promise<UserSettings> {
  const uid = await requireUserId();

  const { data, error } = await supabase
    .from('user_settings')
    .update({
      auto_confirm_mapping: updates.auto_confirm_mapping,
      retention_months: updates.retention_months,
      default_currency: updates.default_currency,
      enable_subcategories: updates.enable_subcategories,
      theme: updates.theme,
      kpi_prefs: updates.kpi_prefs,
      preferred_market_provider: updates.preferred_market_provider,
    })
    .eq('user_id', uid)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as UserSettings;
}

/**
 * Update preferred market provider
 */
export async function setPreferredMarketProvider(
  provider: 'yahoo' | 'stooq'
): Promise<void> {
  await updateUserSettings({
    preferred_market_provider: provider,
  });
}

/**
 * Get preferred market provider
 */
export async function getPreferredMarketProvider(): Promise<'yahoo' | 'stooq'> {
  const settings = await getUserSettings();
  return settings.preferred_market_provider || 'yahoo';
}