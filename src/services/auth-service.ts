import { supabase } from "../integrations/supabase/client";
import { t } from "../i18n/serviceT";

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
    throw new Error(t("authService.notSignedIn", "Nicht angemeldet. Bitte zuerst einloggen."));
  }
  return uid;
}

/**
 * Zugangstoken des angemeldeten Nutzers — `null`, wenn niemand angemeldet ist.
 *
 * **Warum das hier steht und nicht beim Aufrufer** (WP 6.3): Die ADR
 * `supabase-abloesung.md` verhängt einen Neubau-Stopp — keine neuen
 * `supabase.auth`-Aufrufstellen. Die Billing-Slice braucht einen Token für den
 * EntitlementService; ein weiterer direkter `getSession()`-Aufruf im neuen
 * Code wäre genau der Verstoss. WP 2.2 sieht diese Naht ohnehin vor
 * („`auth-service`: `getAccessToken()`") und zieht die bestehenden Stellen
 * später hierher um.
 *
 * Wirft nicht: „nicht angemeldet" ist in einer local-first App ein normaler
 * Zustand, kein Fehler. Was das bedeutet, entscheidet der Aufrufer.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}