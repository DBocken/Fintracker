import { useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, Waypoints, PieChart, Wallet, HeartPulse, Trophy, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AdvancedBalanceChart } from "@/components/AdvancedBalanceChart";
import { SpendingBreakdownCard, ExpensesOverTimeCard } from "./TransactionCharts";
import { AccountCards } from "@/components/accounts/AccountCards";
import { SankeyChart } from "@/components/premium-dashboard/SankeyChart";
import { cn } from "@/lib/utils";

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

type StoryView = "verlauf" | "fluss" | "kategorien" | "ausgaben" | "konten";

const VIEWS: { key: StoryView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "verlauf", label: "Verlauf", icon: Activity },
  { key: "fluss", label: "Fluss", icon: Waypoints },
  { key: "kategorien", label: "Kategorien", icon: PieChart },
  { key: "ausgaben", label: "Ausgaben", icon: Wallet },
  { key: "konten", label: "Konten", icon: Wallet },
];

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
  const current = (params.get("view") as StoryView) || "verlauf";
  const index = Math.max(0, VIEWS.findIndex((v) => v.key === current));

  const setView = (key: StoryView) => {
    const next = new URLSearchParams(params);
    next.set("view", key);
    setParams(next, { replace: true });
  };

  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (Math.abs(dx) > 50) {
      const dir = dx < 0 ? 1 : -1;
      const nextIdx = Math.min(VIEWS.length - 1, Math.max(0, index + dir));
      setView(VIEWS[nextIdx].key);
    }
    touchStartX.current = null;
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

      {/* Ansicht-Navigation (Icons) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const active = v.key === current;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"
              )}
              aria-pressed={active}
            >
              <Icon className="h-3.5 w-3.5" />
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Aktive Ansicht – eine Hauptaussage pro Bildschirm */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="min-h-[60vh]">
        {current === "verlauf" && <AdvancedBalanceChart endBalanceFromAccounts={totalEffectiveBalance} />}
        {current === "fluss" && <SankeyChart data={sankeyData} enableDrilldown={false} />}
        {current === "kategorien" && <SpendingBreakdownCard sunburst={sunburst} />}
        {current === "ausgaben" && <ExpensesOverTimeCard series={series} />}
        {current === "konten" && <AccountCards balances={effectiveBalances} totalBalance={totalEffectiveBalance} />}
      </div>

      {/* Punkt-Indikator */}
      <div className="flex justify-center gap-1.5">
        {VIEWS.map((v, i) => (
          <span
            key={v.key}
            className={cn("h-1.5 rounded-full transition-all", i === index ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30")}
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
