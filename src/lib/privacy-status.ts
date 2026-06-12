import type { Tier } from "@/lib/tier";

/**
 * Privacy-Status für den Header-Indikator (#41).
 *
 * Die Aussagen hier müssen dem tatsächlichen Code-Verhalten entsprechen
 * (kein Marketing über der Realität):
 * - Anonym: Es existiert kein Codepfad, der Finanzdaten an einen Server
 *   sendet. Analytics-Einwilligung setzt Login voraus
 *   (analytics-consent-service → requireUserId), Bank-Sync ebenso.
 * - Eingeloggt: Zum Server gehen Anmeldung (Supabase Auth),
 *   Bank-Requisition (GoCardless) und Einstellungen — niemals
 *   Transaktionen, Schulden oder Briefe.
 * - Aggregierte Statistik nur nach explizitem Opt-in, verschlüsselt und
 *   mit Suppression (< 5 Events werden unterdrückt,
 *   analytics-aggregation-service → MIN_LOCAL_EVENTS).
 */

export type ServerContactLevel = "none" | "account" | "account_and_analytics";

export interface PrivacyStatus {
  serverContact: ServerContactLevel;
  /** Kurzzeile für das Indikator-Panel. */
  serverContactLabel: string;
  /** Was prinzipiell zum Server geht (leer im Anonym-Modus). */
  sharedWithServer: string[];
  /** Was das Gerät nie verlässt. */
  neverShared: string[];
}

const NEVER_SHARED = ["Transaktionen", "Schulden", "Briefe & Dokumente", "Kategorien & Budgets"];

export function derivePrivacyStatus(tier: Tier, analyticsOptIn: boolean): PrivacyStatus {
  if (tier === "anonymous") {
    return {
      serverContact: "none",
      serverContactLabel: "Letzter Server-Kontakt: keiner",
      sharedWithServer: [],
      neverShared: NEVER_SHARED,
    };
  }

  const shared = ["Anmeldung (Google via Supabase)", "Bank-Anbindung (GoCardless-Requisition)", "Einstellungen"];

  if (analyticsOptIn) {
    return {
      serverContact: "account_and_analytics",
      serverContactLabel: "Server-Kontakt: Konto, Bank-Anbindung, aggregierte Statistik (Opt-in)",
      sharedWithServer: [...shared, "Aggregierte Statistik (verschlüsselt, Opt-in)"],
      neverShared: NEVER_SHARED,
    };
  }

  return {
    serverContact: "account",
    serverContactLabel: "Server-Kontakt: nur Konto & Bank-Anbindung",
    sharedWithServer: shared,
    neverShared: NEVER_SHARED,
  };
}
