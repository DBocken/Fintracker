"use client";

import type { ReactNode } from "react";
import { FeatureGate } from "@/components/FeatureGate";
import type { FeatureKey } from "@/lib/tier";

type RequireTierProps = {
  feature: FeatureKey;
  children: ReactNode;
  /** Eigener Fallback statt des Standard-Locked-Previews. */
  fallback?: ReactNode;
};

/**
 * @deprecated Dünner Kompatibilitäts-Wrapper um {@link FeatureGate}.
 *
 * Die Guard-Logik (inkl. Login- vs. Premium-Story) lebt jetzt
 * zentral in `FeatureGate`/`PremiumUpsell`. Neue Aufrufer sollten direkt
 * `<FeatureGate>` verwenden; dieser Export bleibt nur, um bestehende
 * Importe nicht zu brechen.
 */
export default function RequireTier({ feature, children, fallback }: RequireTierProps) {
  return (
    <FeatureGate feature={feature} fallback={fallback}>
      {children}
    </FeatureGate>
  );
}
