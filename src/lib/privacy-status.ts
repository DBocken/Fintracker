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
 * - Cloud-MCP (Opt-in, bewusste Ausnahme zum Local-only-Prinzip): Bei aktivem
 *   Sync verlassen Finanz-Aggregate — Monatssummen sowie Budget- und
 *   Kategorienamen — das Gerät. Dann dürfen "Kategorien & Budgets" NICHT mehr
 *   als "verlässt dein Gerät nie" ausgewiesen werden (F-PRIV-1 / F-MCP-2).
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

const NEVER_SHARED_BASE = ["Transaktionen", "Schulden", "Briefe & Dokumente"];
const CATEGORIES_BUDGETS = "Kategorien & Budgets";
const MCP_AGGREGATES = "Finanz-Aggregate: Monatssummen, Budget- & Kategorienamen (MCP, Opt-in)";

export interface PrivacyStatusInput {
  /** Ob auf diesem Gerät ein MCP-Cloud-Sync aktiv ist (cloud-mcp-sync-service). */
  mcpSyncActive?: boolean;
}

export function derivePrivacyStatus(
  tier: Tier,
  analyticsOptIn: boolean,
  input: PrivacyStatusInput = {},
): PrivacyStatus {
  // MCP setzt Login voraus; im Anonym-Modus gibt es keinen aktiven Sync.
  const mcpSyncActive = tier !== "anonymous" && !!input.mcpSyncActive;

  // Kategorien & Budgets verlassen das Gerät nur, wenn MCP-Sync aktiv ist.
  const neverShared = mcpSyncActive
    ? [...NEVER_SHARED_BASE]
    : [...NEVER_SHARED_BASE, CATEGORIES_BUDGETS];

  if (tier === "anonymous") {
    return {
      serverContact: "none",
      serverContactLabel: "Letzter Server-Kontakt: keiner",
      sharedWithServer: [],
      neverShared,
    };
  }

  const shared = ["Anmeldung (Google via Supabase)", "Bank-Anbindung (GoCardless-Requisition)", "Einstellungen"];
  if (analyticsOptIn) shared.push("Aggregierte Statistik (verschlüsselt, Opt-in)");
  if (mcpSyncActive) shared.push(MCP_AGGREGATES);

  const serverContact: ServerContactLevel = analyticsOptIn ? "account_and_analytics" : "account";
  const labelParts = ["Konto", "Bank-Anbindung"];
  if (analyticsOptIn) labelParts.push("aggregierte Statistik (Opt-in)");
  if (mcpSyncActive) labelParts.push("Finanz-Aggregate (MCP, Opt-in)");

  return {
    serverContact,
    serverContactLabel: `Server-Kontakt: ${labelParts.join(", ")}`,
    sharedWithServer: shared,
    neverShared,
  };
}
