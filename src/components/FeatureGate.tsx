"use client";

import type { ReactNode } from "react";
import { useFeatureAccess } from "@/hooks/useTier";
import type { FeatureKey } from "@/lib/tier";
import { PremiumUpsell } from "@/components/PremiumUpsell";

interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  /** Custom fallback. Defaults to an honest explanation/preview card. */
  fallback?: ReactNode;
}

/** Declarative gating: renders `children` only if the user's tier covers `feature`. */
export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const hasAccess = useFeatureAccess(feature);

  if (hasAccess) return <>{children}</>;

  return <>{fallback ?? <PremiumUpsell feature={feature} />}</>;
}
