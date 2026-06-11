"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  isFeatureEnabled,
  requiredTierFor,
  resolveTier,
  type FeatureKey,
  type Tier,
} from "@/lib/tiers";

export type UseTierResult = {
  /** Aktuelles Tier des Nutzers. */
  tier: Tier;
  /** true, solange der Auth-Status noch lädt. */
  loading: boolean;
  /** Darf der Nutzer dieses Feature verwenden? */
  isEnabled: (feature: FeatureKey) => boolean;
  /** Welches Tier ein Feature mindestens braucht. */
  requiredTier: (feature: FeatureKey) => Tier;
};

/**
 * Einzige React-Schnittstelle zum Tier-System (Issue #27).
 * Premium-Entitlements kommen mit Issue #52 — bis dahin sind eingeloggte
 * Nutzer "free" und Premium-Gating ist nicht scharf (siehe lib/tiers.ts).
 */
export function useTier(): UseTierResult {
  const { status } = useAuth();

  return useMemo(() => {
    const tier = resolveTier(status === "authenticated");
    return {
      tier,
      loading: status === "loading",
      isEnabled: (feature: FeatureKey) => isFeatureEnabled(feature, tier),
      requiredTier: requiredTierFor,
    };
  }, [status]);
}

export default useTier;
