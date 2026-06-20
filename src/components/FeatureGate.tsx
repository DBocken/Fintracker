"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTier } from "@/hooks/useTier";
import { hasFeatureAccess, type FeatureKey } from "@/lib/tier";
import { PremiumUpsell } from "@/components/PremiumUpsell";

interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  /**
   * Eigener Fallback. Standard ist ein begehrlicher Locked-Preview
   * (`PremiumUpsell`), der je nach benötigtem Tier Login- oder
   * Premium-Story zeigt.
   */
  fallback?: ReactNode;
}

/**
 * Einheitliche Zugriffs-Guard (Audit B/D): rendert `children` nur, wenn
 * das Tier des Nutzers `feature` abdeckt. Während des Auth-Ladens wird
 * nichts gerendert, um ein Aufblitzen gesperrter Inhalte zu vermeiden.
 *
 * Ersetzt die frühere Doppelung aus FeatureGate + RequireTier — Letzteres
 * ist jetzt ein dünner Wrapper hierauf.
 */
export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const tier = useTier();
  const { status } = useAuth();

  if (status === "loading") return null;
  if (hasFeatureAccess(tier, feature)) return <>{children}</>;

  return <>{fallback ?? <PremiumUpsell feature={feature} />}</>;
}

export default FeatureGate;
