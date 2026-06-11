/**
 * Zentrales Tier-System (Issue #27, Epic #19).
 *
 * Drei Stufen:
 * - anonymous: App ohne Anmeldung, alles rein Lokale ist verfügbar
 * - free:      Google-Login, schaltet Features frei, die eine Server-Identität
 *              brauchen (Bankanbindung, Profil)
 * - premium:   Bezahl-Tier (Paywall kommt mit Epic #25)
 *
 * Dieses Modul ist bewusst frei von React/Supabase-Importen, damit die
 * Gating-Logik pur und testbar bleibt. Die einzige Quelle der Wahrheit für
 * "welches Feature braucht welches Tier" ist FEATURE_TIERS.
 */

export type Tier = "anonymous" | "free" | "premium";

const TIER_ORDER: Record<Tier, number> = {
  anonymous: 0,
  free: 1,
  premium: 2,
};

export type FeatureKey =
  // Rein lokal — funktioniert ohne jeden Server-Kontakt
  | "csv_import"
  | "dashboard"
  | "coach"
  | "debts"
  | "net_worth"
  | "categories"
  | "export"
  | "backups"
  | "local_encryption"
  // Braucht eine Server-Identität (Supabase-Auth)
  | "bank_sync"
  | "profile"
  | "cloud_settings"
  // Bezahl-Features (Gating wird mit Issue #53 scharf geschaltet)
  | "premium_analytics"
  | "simulation"
  | "trading";

export const FEATURE_TIERS: Record<FeatureKey, Tier> = {
  csv_import: "anonymous",
  dashboard: "anonymous",
  coach: "anonymous",
  debts: "anonymous",
  net_worth: "anonymous",
  categories: "anonymous",
  export: "anonymous",
  backups: "anonymous",
  local_encryption: "anonymous",

  bank_sync: "free",
  profile: "free",
  cloud_settings: "free",

  premium_analytics: "premium",
  simulation: "premium",
  trading: "premium",
};

/**
 * Solange es keine Paywall gibt (Issue #52/#53), werden Premium-Features
 * nicht durchgesetzt — niemand verliert Funktionalität, bevor es ein
 * ehrliches Abo gibt. Mit Issue #53 wird dieser Schalter auf true gestellt
 * bzw. durch echte Entitlements ersetzt.
 */
export const PREMIUM_ENFORCED = false;

/** Leitet das aktuelle Tier aus Auth-Status und (künftigem) Entitlement ab. */
export function resolveTier(
  isAuthenticated: boolean,
  hasPremiumEntitlement = false,
): Tier {
  if (!isAuthenticated) return "anonymous";
  return hasPremiumEntitlement ? "premium" : "free";
}

/** true, wenn das aktuelle Tier die Anforderung erfüllt (>=). */
export function tierSatisfies(current: Tier, required: Tier): boolean {
  return TIER_ORDER[current] >= TIER_ORDER[required];
}

/** Das für ein Feature nötige Tier. */
export function requiredTierFor(feature: FeatureKey): Tier {
  return FEATURE_TIERS[feature];
}

/**
 * Kernfrage des Gatings: Darf das aktuelle Tier dieses Feature nutzen?
 *
 * Premium-Features sind erst gesperrt, wenn die Paywall live ist
 * (premiumEnforced) — bis dahin sind sie für alle offen.
 */
export function isFeatureEnabled(
  feature: FeatureKey,
  currentTier: Tier,
  premiumEnforced: boolean = PREMIUM_ENFORCED,
): boolean {
  const required = FEATURE_TIERS[feature];
  if (required === "premium" && !premiumEnforced) return true;
  return tierSatisfies(currentTier, required);
}
