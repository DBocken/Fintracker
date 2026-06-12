import { ResponsivePremiumDashboard } from "@/components/premium-dashboard/ResponsivePremiumDashboard";
import { FeatureGate } from "@/components/FeatureGate";

/**
 * Analyse-Bereich (Issue #40): Sankey-Drilldown, Heatmap, Wochenmuster,
 * Smart Insights — der spätere Premium-Tier. Das einfache Sankey auf
 * Hauptkategorien-Ebene lebt FREE im Basis-Dashboard.
 */
export default function AnalysisPage() {
  return (
    <FeatureGate feature="premiumAnalytics">
      <ResponsivePremiumDashboard />
    </FeatureGate>
  );
}
