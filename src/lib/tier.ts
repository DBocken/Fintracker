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
 * Premium is not yet purchasable, so authenticated users are always
 * 'free' until the paywall (#25) lands. While loading we assume the most
 * restrictive tier to avoid flashing premium content.
 */
export function deriveTier(status: AuthStatus): Tier {
  return status === "authenticated" ? "free" : "anonymous";
}
