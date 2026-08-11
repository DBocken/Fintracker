import type { UserSettings } from '../types';
import {
  completeTutorialChapter as completeLocalTutorialChapter,
  getLocalUserSettings,
  updateLocalUserSettings,
} from './local-settings-service';
import type { TutorialChapterId } from '@/lib/tutorial-sequence';

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
 * Hält ein abgeschlossenes Tutorial-Kapitel fest (samt Freischaltung seines
 * Bereichs). Serialisiert im Store, nicht in der Aufrufstelle — siehe dort.
 */
export async function completeTutorialChapter(
  chapter: TutorialChapterId,
): Promise<UserSettings> {
  return completeLocalTutorialChapter(chapter);
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
