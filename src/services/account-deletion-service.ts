import { supabase } from '@/integrations/supabase/client';
import { clearAllLocalData } from './local-data-reset';

/**
 * DSGVO-Löschung (Issue #31).
 *
 * Lokale Löschung ist auch anonym möglich. Die Konto-Löschung ruft die
 * Edge Function `delete-account` (Service-Role) auf, die GoCardless-Zugriffe
 * beendet, alle Cloud-Zeilen entfernt und den Auth-User löscht.
 */

/** Löscht ausschließlich die lokalen Daten dieses Geräts. */
export async function deleteLocalData(): Promise<void> {
  await clearAllLocalData();
}

/**
 * Löscht das Konto serverseitig und – auf Wunsch – die lokalen Daten.
 * Meldet den Nutzer anschließend ab.
 */
export async function deleteAccount(options?: { alsoLocal?: boolean }): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', {
    body: { action: 'delete-account' },
  });

  if (error) {
    throw new Error(error.message || 'Konto konnte nicht gelöscht werden.');
  }

  if (options?.alsoLocal) {
    await clearAllLocalData();
  }

  // Session lokal beenden; der Auth-User existiert serverseitig nicht mehr.
  await supabase.auth.signOut();
}
