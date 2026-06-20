"use client";

import type { ReactNode } from "react";
import { FeatureGate } from "@/components/FeatureGate";
import { ROUTE_GUARDS } from "@/components/layout/nav-config";

/**
 * Wendet die zentrale Route-Guard-Map (`ROUTE_GUARDS`) auf eine Route an.
 * Liegt für `path` kein Eintrag vor, werden die Kinder ungehindert
 * gerendert — der Guard ist also opt-in pro Pfad.
 */
export default function RouteGuard({ path, children }: { path: string; children: ReactNode }) {
  const feature = ROUTE_GUARDS[path];
  if (!feature) return <>{children}</>;
  return <FeatureGate feature={feature}>{children}</FeatureGate>;
}
