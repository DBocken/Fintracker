/**
 * Central definition of the tier system. This is the single source of
 * truth for which features require which tier — components should check
 * `hasFeatureAccess`/`tierMeets` instead of scattering their own
 * `if (user)`/`if (premium)` checks.
 */

export type Tier = "anonymous" | "free" | "premium";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type FeatureKey = "bankSync" | "premiumAnalytics" | "simulation" | "trading";

/** Maps each gated feature to the minimum tier required to use it. */
export const FEATURES: Record<FeatureKey, Tier> = {
  bankSync: "free",
  premiumAnalytics: "premium",
  simulation: "premium",
  trading: "premium",
};

const TIER_RANK: Record<Tier, number> = {
  anonymous: 0,
  free: 1,
  premium: 2,
};

/** Returns true if `userTier` is at least as high as `requiredTier`. */
export function tierMeets(userTier: Tier, requiredTier: Tier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
}

/** Returns true if `userTier` grants access to `feature`. */
export function hasFeatureAccess(userTier: Tier, feature: FeatureKey): boolean {
  return tierMeets(userTier, FEATURES[feature]);
}

/**
 * Pure derivation of the current tier from auth status, separated so it
 * can be unit-tested without mocking AuthProvider/Supabase.
 *
 * Premium is not yet purchasable, so authenticated users are normally
 * 'free' until the paywall (#25) lands. While loading we assume the most
 * restrictive tier to avoid flashing premium content. Alpha testers can
 * unlock premium locally via an access code (`override`); the override only
 * ever upgrades and never downgrades the base tier.
 */
export function deriveTier(status: AuthStatus, override?: Tier | null): Tier {
  const base: Tier = status === "authenticated" ? "free" : "anonymous";
  if (override && TIER_RANK[override] > TIER_RANK[base]) return override;
  return base;
}

/** localStorage key for the locally stored alpha/premium access override. */
export const TIER_OVERRIDE_KEY = "ausgabentracker_tier_override_v1";

/** Access codes that unlock a tier locally (alpha programme). */
const ACCESS_CODES: Record<string, Tier> = {
  alphatester: "premium",
};

/**
 * Reads the locally stored tier override, if any. Returns null when no valid
 * override is present (or when running without `window`).
 */
export function getTierOverride(): Tier | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(TIER_OVERRIDE_KEY);
  return raw === "premium" || raw === "free" ? raw : null;
}

/**
 * Validates an access code and, if valid, persists the unlocked tier locally.
 * Returns the unlocked tier on success, or null when the code is unknown.
 */
export function setTierOverride(code: string): Tier | null {
  const tier = ACCESS_CODES[code.trim().toLowerCase()];
  if (!tier) return null;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TIER_OVERRIDE_KEY, tier);
  }
  return tier;
}

/** Removes any locally stored tier override (back to the base tier). */
export function clearTierOverride(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TIER_OVERRIDE_KEY);
  }
}
