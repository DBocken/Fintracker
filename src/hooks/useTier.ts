"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  deriveTier,
  hasFeatureAccess,
  getTierOverride,
  TIER_OVERRIDE_KEY,
  type FeatureKey,
  type Tier,
} from "@/lib/tier";

/** Event dispatched on the window when the local tier override changes. */
export const TIER_OVERRIDE_EVENT = "tier-override-change";

/**
 * Tracks the locally stored tier override and stays in sync with changes,
 * whether they happen in this tab (custom event) or another (storage event).
 */
function useTierOverride(): Tier | null {
  const [override, setOverride] = useState<Tier | null>(() => getTierOverride());

  useEffect(() => {
    const sync = () => setOverride(getTierOverride());
    const onStorage = (e: StorageEvent) => {
      if (e.key === TIER_OVERRIDE_KEY) sync();
    };
    window.addEventListener(TIER_OVERRIDE_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(TIER_OVERRIDE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return override;
}

/** Current tier of the logged-in user: 'anonymous' | 'free' | 'premium'. */
export function useTier(): Tier {
  const { status } = useAuth();
  const override = useTierOverride();
  return deriveTier(status, override);
}

/** Whether the current user has access to the given feature. */
export function useFeatureAccess(feature: FeatureKey): boolean {
  const tier = useTier();
  return hasFeatureAccess(tier, feature);
}
