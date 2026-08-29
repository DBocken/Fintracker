import { supabase } from "../integrations/supabase/client";
import { t } from "../i18n/serviceT";

/**
 * Liefert das Subject des angemeldeten Nutzers — `null`, wenn niemand
 * angemeldet ist.
 *
 * Wirft nicht, auch nicht bei einem Anbieterfehler: „nicht angemeldet" ist in
 * einer local-first App ein normaler Zustand. Was das bedeutet, entscheidet
 * der Aufrufer.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
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

/**
 * Beendet die Sitzung beim Identitätsanbieter (WP 2.2).
 *
 * **Warum das hier steht:** Abmelden lag an zwei Stellen direkt auf
 * `supabase.auth.signOut()` — in `LogoutButton` und im Löschpfad
 * (`account-deletion-service`). Beide sind Aufrufstellen, die der
 * Anbieterwechsel sonst einzeln anfassen müsste, und der Löschpfad ist
 * ausgerechnet der, für den Phase 7 „Löschpfad-Parität **vor** jeder
 * Datenbewegung" verlangt.
 *
 * **Wirft, wenn der Anbieter einen Fehler meldet** — anders als
 * `getAccessToken()`. Der Unterschied ist gewollt: Ein fehlgeschlagenes
 * Abmelden ist kein normaler Zustand, sondern eine Sitzung, die noch lebt,
 * während die Oberfläche das Gegenteil behauptet. Das Aufräumen des lokalen
 * Zustands (Cache, Vault-Sperre) hängt am Auth-Ereignis im `AuthProvider`,
 * nicht hier — diese Naht kennt die Oberfläche nicht (§3).
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(t("authService.signOutFailed", "Abmelden fehlgeschlagen."));
  }
}