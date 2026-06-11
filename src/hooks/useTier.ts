"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { deriveTier, hasFeatureAccess, type FeatureKey, type Tier } from "@/lib/tier";

/** Current tier of the logged-in user: 'anonymous' | 'free' | 'premium'. */
export function useTier(): Tier {
  const { status } = useAuth();
  return deriveTier(status);
}

/** Whether the current user has access to the given feature. */
export function useFeatureAccess(feature: FeatureKey): boolean {
  const tier = useTier();
  return hasFeatureAccess(tier, feature);
}
