import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Dot, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { getFinanceFoundation } from "@/services/finance-foundation-service";
import type { FoundationStage } from "@/lib/finance-foundation";
import { cn } from "@/lib/utils";

/** Eine Etappe: Status-Icon, Titel, Begründung und ein sich aufbauender Fortschrittsbalken. */
function StageRow({ stage, animate }: { stage: FoundationStage; animate: boolean }) {
  const targetPct = Math.round(Math.max(0, Math.min(1, stage.progress)) * 100);
  const [width, setWidth] = useState(animate ? 0 : targetPct);

  useEffect(() => {
    if (!animate) {
      setWidth(targetPct);
      return;
    }
    const raf = requestAnimationFrame(() => setWidth(targetPct));
    return () => cancelAnimationFrame(raf);
  }, [targetPct, animate]);

  const isDone = stage.status === "completed";
  const isActive = stage.status === "active";

  return (
    <div className="flex gap-3">
      <div
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs",
          isDone
            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : isActive
              ? "border-[hsl(var(--brand))]/50 bg-[hsl(var(--brand))]/10 text-[hsl(var(--brand))]"
              : "border-border text-muted-foreground",
        )}
        aria-hidden
      >
        {isDone ? <Check className="h-3.5 w-3.5" /> : isActive ? <Dot className="h-5 w-5" /> : <Lock className="h-3 w-3" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("text-sm font-medium", !isDone && !isActive && "text-muted-foreground")}>
            {stage.order}. {stage.title}
          </span>
          {isActive && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{targetPct}%</span>}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{isActive ? stage.whyItMatters : stage.description}</p>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full",
              isDone ? "bg-emerald-500" : "bg-[hsl(var(--brand))]",
              animate && "transition-[width] duration-700 ease-out",
            )}
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * „Dein Finanz-Fundament" – die 6 Etappen als Leiter mit datengetriebenem
 * Fortschritt. Aufbau-Animation (Balken wachsen), schwellwert-/statusbewusst,
 * prefers-reduced-motion-konform.
 */
export default function FoundationLadder() {
  const animate = !useReducedMotion();
  const { data, isLoading } = useQuery({ queryKey: ["finance-foundation"], queryFn: () => getFinanceFoundation() });

  if (isLoading || !data) return null;
  const overall = Math.round(data.overallProgress * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
          Dein Finanz-Fundament
          <span className="text-xs font-normal text-muted-foreground">{overall}% – 6 Etappen</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.stages.map((stage) => (
          <StageRow key={stage.key} stage={stage} animate={animate} />
        ))}
      </CardContent>
    </Card>
  );
}
