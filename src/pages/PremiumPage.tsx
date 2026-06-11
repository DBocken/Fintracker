"use client";

import { ResponsivePremiumDashboard } from "@/components/premium-dashboard/ResponsivePremiumDashboard";
import { FeatureGate } from "@/components/FeatureGate";

export default function PremiumPage() {
  return (
    <FeatureGate feature="premiumAnalytics">
      <ResponsivePremiumDashboard />
    </FeatureGate>
  );
}
