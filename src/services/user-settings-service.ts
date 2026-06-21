import type { UserSettings } from '../types';
import { getLocalUserSettings, updateLocalUserSettings } from './local-settings-service';

// -----------------------------------------------------------------------------
// User Settings CRUD Operations
// -----------------------------------------------------------------------------

/**
 * Get user settings for the current user
 */
export async function getUserSettings(): Promise<UserSettings> {
  return getLocalUserSettings();
}

/**
 * Update user settings
 */
export async function updateUserSettings(
  updates: Partial<UserSettings>
): Promise<UserSettings> {
  return updateLocalUserSettings(updates);
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
