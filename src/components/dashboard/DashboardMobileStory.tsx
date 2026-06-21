import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, Waypoints, PieChart, Mountain, Wallet, CreditCard, HeartPulse, Trophy, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AdvancedBalanceChart } from "@/components/AdvancedBalanceChart";
import { SpendingBreakdownCard, ExpensesOverTimeCard } from "./TransactionCharts";
import { AccountCards } from "@/components/accounts/AccountCards";
import { SankeyChart } from "@/components/premium-dashboard/SankeyChart";
import FinancialLandscape from "@/components/health-score/FinancialLandscape";
import { getFinancialHealth } from "@/services/financial-health-service";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

type StoryView = "verlauf" | "fluss" | "kategorien" | "landschaft" | "ausgaben" | "konten";

const VIEWS: { key: StoryView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "verlauf", label: "Verlauf", icon: Activity },
  { key: "fluss", label: "Fluss", icon: Waypoints },
  { key: "kategorien", label: "Kategorien", icon: PieChart },
  { key: "landschaft", label: "Landschaft", icon: Mountain },
  { key: "ausgaben", label: "Ausgaben", icon: Wallet },
  { key: "konten", label: "Konten", icon: CreditCard },
];

const isStoryView = (value: string | null): value is StoryView =>
  VIEWS.some((view) => view.key === value);

export function resolveSwipeTarget(
  index: number,
  deltaX: number,
  deltaY: number,
  viewCount = VIEWS.length,
): number {
  if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY)) return index;
  const direction = deltaX < 0 ? 1 : -1;
  return Math.min(viewCount - 1, Math.max(0, index + direction));
}

/** Eigene Ansicht für die Finanzlandschaft – lädt die Gesundheitsdaten erst, wenn sie gezeigt wird. */
function LandscapeView() {
  const { data: health, isLoading } = useQuery({ queryKey: ["financial-health"], queryFn: getFinancialHealth });
  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-muted" aria-busy />;
  }
  if (!health || health.subScores.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Noch keine Finanzgesundheit berechnet. Erfasse Konten und Buchungen, um deine Landschaft zu sehen.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="mx-auto w-full max-w-xs">
      <FinancialLandscape health={health} variant="hero-compact" />
    </div>
  );
}

interface Props {
  className?: string;
  currentBalance: number;
  periodNet: number;
  sunburst: React.ComponentProps<typeof SpendingBreakdownCard>["sunburst"];
  series: React.ComponentProps<typeof ExpensesOverTimeCard>["series"];
  sankeyData: React.ComponentProps<typeof SankeyChart>["data"];
  effectiveBalances: React.ComponentProps<typeof AccountCards>["balances"];
  totalEffectiveBalance: number;
  topInsight?: string | null;
}

/**
 * Mobile „Finanz-Story" (Audit P1.4): ein persistenter Finance Pulse oben und
 * darunter adressierbare, einzeln gezeigte Ansichten (Deep-Link via `?view=`).
 * Pro Ansicht etwa eine Bildschirmhöhe mit einer klaren Hauptaussage; horizontal
 * wischbar zwischen den Ansichten. Nur mobil – Desktop behält das Raster.
 */
export default function DashboardMobileStory({
  className,
  currentBalance,
  periodNet,
  sunburst,
  series,
  sankeyData,
  effectiveBalances,
  totalEffectiveBalance,
  topInsight,
}: Props) {
  const [params, setParams] = useSearchParams();
  const requestedView = params.get("view");
  const current: StoryView = isStoryView(requestedView) ? requestedView : "verlauf";
  const index = Math.max(0, VIEWS.findIndex((v) => v.key === current));

  const setView = (key: StoryView) => {
    const next = new URLSearchParams(params);
    next.set("view", key);
    setParams(next, { replace: true });
  };

  const reduce = useReducedMotion();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    const touch = e.changedTouches[0];
    if (!start || !touch) return;
    const nextIdx = resolveSwipeTarget(index, touch.clientX - start.x, touch.clientY - start.y);
    if (nextIdx !== index) {
      setView(VIEWS[nextIdx].key);
    }
    touchStart.current = null;
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Finance Pulse */}
      <Card variant="premium">
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Aktueller Kontostand</div>
          <div className={cn("text-3xl font-bold", currentBalance >= 0 ? "text-foreground" : "text-warning")}>
            {euro.format(currentBalance)}
          </div>
          <div className="mt-1 text-sm">
            <span className="text-muted-foreground">Saldo im Zeitraum: </span>
            <span className={periodNet >= 0 ? "text-positive" : "text-warning"}>
              {periodNet >= 0 ? "+" : ""}{euro.format(periodNet)}
            </span>
          </div>
          {topInsight && <div className="mt-2 rounded-md bg-muted/50 p-2 text-xs">{topInsight}</div>}
        </CardContent>
      </Card>

      {/* Ansicht-Navigation: vollständig sichtbares Icon-Raster, kein horizontales Scrollen */}
      <div className="grid grid-cols-3 gap-1 min-[400px]:grid-cols-6" role="tablist" aria-label="Diagramm-Ansicht">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const active = v.key === current;
          return (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(v.key)}
              className={cn(
                "flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-[10px] leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{v.label}</span>
            </button>
          );
        })}
      </div>

      {/* Aktive Ansicht – eine Hauptaussage pro Bildschirm, erst beim Anzeigen gerendert */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="min-h-[60vh] touch-pan-y">
        {current === "verlauf" && <AdvancedBalanceChart endBalanceFromAccounts={totalEffectiveBalance} />}
        {current === "fluss" && <SankeyChart data={sankeyData} enableDrilldown={false} />}
        {current === "kategorien" && <SpendingBreakdownCard sunburst={sunburst} />}
        {current === "landschaft" && <LandscapeView />}
        {current === "ausgaben" && <ExpensesOverTimeCard series={series} />}
        {current === "konten" && <AccountCards balances={effectiveBalances} totalBalance={totalEffectiveBalance} />}
      </div>

      {/* Punkt-Indikator */}
      <div className="flex justify-center gap-1.5">
        {VIEWS.map((v, i) => (
          <span
            key={v.key}
            className={cn("h-1.5 rounded-full", !reduce && "transition-all", i === index ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30")}
          />
        ))}
      </div>

      {/* Sprünge zu eigenständigen Seiten */}
      <div className="flex flex-wrap gap-2">
        <Link to="/coach" className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs text-muted-foreground">
          <HeartPulse className="h-3.5 w-3.5" /> Finanzgesundheit <ArrowRight className="h-3 w-3" />
        </Link>
        <Link to="/milestones" className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs text-muted-foreground">
          <Trophy className="h-3.5 w-3.5" /> Meilensteine <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
