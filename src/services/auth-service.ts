import { supabase } from "../integrations/supabase/client";

/**
 * Liefert die aktuelle Supabase-User-ID oder null, wenn nicht angemeldet.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Erzwingt eine Anmeldung und gibt die User-ID zurück.
 * Wirf einen Fehler, wenn keine Session vorhanden ist.
 */
export async function requireUserId(): Promise<string> {
  const uid = await getCurrentUserId();
  if (!uid) {
    throw new Error("Nicht angemeldet. Bitte zuerst einloggen.");
  }
  return uid;
}