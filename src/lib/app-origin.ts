/**
 * Einheitliche Ermittlung des Redirect-Origins für externe Rückleitungen
 * (z. B. GoCardless-Bankanbindung, OAuth-Callback).
 *
 * Vorher war diese Logik dreifach kopiert (Login, AccountManager,
 * GoCardlessConnect — Audit D). Jetzt eine Quelle der Wahrheit.
 */

/** Produktions-Origin, an den externe Dienste zurückleiten. */
export const PRODUCTION_APP_ORIGIN = "https://fintracker-phi.vercel.app";

/**
 * In lokaler Entwicklung der aktuelle Origin (damit Callbacks auf
 * localhost zurückkommen), sonst der feste Produktions-Origin.
 */
export function getRedirectOrigin(): string {
  if (typeof window === "undefined") return PRODUCTION_APP_ORIGIN;
  const { hostname, origin } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return origin;
  }
  return PRODUCTION_APP_ORIGIN;
}
