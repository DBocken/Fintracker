import { ResponsivePremiumDashboard } from "@/components/premium-dashboard/ResponsivePremiumDashboard";

/**
 * Analyse-Bereich (Issue #40): Sankey-Drilldown, Heatmap, Wochenmuster,
 * Smart Insights — der spätere Premium-Tier. Das einfache Sankey auf
 * Hauptkategorien-Ebene lebt FREE im Basis-Dashboard.
 *
 * Tier-Gating erfolgt zentral über die Route-Guard-Schicht (ROUTE_GUARDS).
 */
export default function AnalysisPage() {
  return <ResponsivePremiumDashboard />;
}
