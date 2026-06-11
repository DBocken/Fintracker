"use client";

import TradingDashboard from "@/components/trading/TradingDashboard";
import { FeatureGate } from "@/components/FeatureGate";

export default function TradingPage() {
  return (
    <FeatureGate feature="trading">
      <TradingDashboard />
    </FeatureGate>
  );
}
