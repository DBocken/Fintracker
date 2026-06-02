import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/integrations/supabase/client";

const CALLBACK_SCHEME = "ausgabentracker";
const CALLBACK_HOST = "auth-callback";
const CALLBACK_URL_PREFIX = `${CALLBACK_SCHEME}://${CALLBACK_HOST}`;

export function getNativeRedirectTo() {
  return CALLBACK_URL_PREFIX;
}

export function initCapacitorAuthBridge() {
  if (!Capacitor.isNativePlatform()) return;

  App.addListener("appUrlOpen", async ({ url }) => {
    if (!url || !url.startsWith(CALLBACK_URL_PREFIX)) return;

    try {
      const parsed = new URL(url);
      const code = parsed.searchParams.get("code");
      const error = parsed.searchParams.get("error") ?? parsed.searchParams.get("error_description");

      if (error) {
        // Optional: Fehler-Logging
        // console.warn("Auth error:", error);
      }

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }
    } finally {
      // Browser schließen und zur App zurück
      try {
        await Browser.close();
      } catch {}
      // Zur Startseite zurück
      window.location.href = window.location.origin;
    }
  });
}