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
import { useServerEntitlement } from "@/hooks/useServerEntitlement";
import {
  DEMO_ACTIVE_EVENT,
  DEMO_ACTIVE_KEY,
  isDemoDataActive,
} from "@/services/demo-data-service";

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

/**
 * Tracks whether the demo dataset is active and stays in sync with changes,
 * whether they happen in this tab (custom event) or another (storage event).
 */
function useDemoActive(): boolean {
  const [active, setActive] = useState<boolean>(() => isDemoDataActive());

  useEffect(() => {
    const sync = () => setActive(isDemoDataActive());
    const onStorage = (e: StorageEvent) => {
      if (e.key === DEMO_ACTIVE_KEY) sync();
    };
    window.addEventListener(DEMO_ACTIVE_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(DEMO_ACTIVE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return active;
}

/** Current tier of the logged-in user: 'anonymous' | 'free' | 'premium'. */
export function useTier(): Tier {
  const { status } = useAuth();
  const override = useTierOverride();
  const demoActive = useDemoActive();
  // Seit WP 6.3 entscheidet der Server mit. Solange er nichts sagt (kein
  // Dienst hinterlegt, nicht angemeldet, nicht erreichbar), bleibt alles wie
  // zuvor — die App ist local-first und soll offline nicht weniger wert sein.
  const { tier: serverEntitlement } = useServerEntitlement();
  return deriveTier(status, override, demoActive, serverEntitlement);
}

/** Whether the current user has access to the given feature. */
export function useFeatureAccess(feature: FeatureKey): boolean {
  const tier = useTier();
  return hasFeatureAccess(tier, feature);
}
