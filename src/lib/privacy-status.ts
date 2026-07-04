import type { Tier } from "@/lib/tier";
import { t } from "@/i18n/serviceT";

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

function neverSharedBase(): string[] {
  return [
    t("privacy.status.neverSharedTransactions", "Transaktionen"),
    t("privacy.status.neverSharedDebts", "Schulden"),
    t("privacy.status.neverSharedLetters", "Briefe & Dokumente"),
  ];
}
function categoriesBudgetsLabel(): string {
  return t("privacy.status.categoriesAndBudgets", "Kategorien & Budgets");
}
function mcpAggregatesLabel(): string {
  return t("privacy.status.mcpAggregates", "Finanz-Aggregate: Monatssummen, Budget- & Kategorienamen (MCP, Opt-in)");
}

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
    ? [...neverSharedBase()]
    : [...neverSharedBase(), categoriesBudgetsLabel()];

  if (tier === "anonymous") {
    return {
      serverContact: "none",
      serverContactLabel: t("privacy.status.serverContactNone", "Letzter Server-Kontakt: keiner"),
      sharedWithServer: [],
      neverShared,
    };
  }

  const shared = [
    t("privacy.status.sharedLogin", "Anmeldung (Google via Supabase)"),
    t("privacy.status.sharedBankConnection", "Bank-Anbindung (GoCardless-Requisition)"),
    t("privacy.status.sharedSettings", "Einstellungen"),
  ];
  if (analyticsOptIn) shared.push(t("privacy.status.sharedAnalytics", "Aggregierte Statistik (verschlüsselt, Opt-in)"));
  if (mcpSyncActive) shared.push(mcpAggregatesLabel());

  const serverContact: ServerContactLevel = analyticsOptIn ? "account_and_analytics" : "account";
  const labelParts = [
    t("privacy.status.labelPartAccount", "Konto"),
    t("privacy.status.labelPartBankConnection", "Bank-Anbindung"),
  ];
  if (analyticsOptIn) labelParts.push(t("privacy.status.labelPartAnalytics", "aggregierte Statistik (Opt-in)"));
  if (mcpSyncActive) labelParts.push(t("privacy.status.labelPartMcp", "Finanz-Aggregate (MCP, Opt-in)"));

  return {
    serverContact,
    serverContactLabel: `${t("privacy.status.serverContactLabelPrefix", "Server-Kontakt: ")}${labelParts.join(", ")}`,
    sharedWithServer: shared,
    neverShared,
  };
}
