import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Waves } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { getWaterfallPlan } from "@/services/waterfall-service";
import type { WaterfallStep, WaterfallStepKey } from "@/lib/budget-waterfall";
import { cn } from "@/lib/utils";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const STEP_FILL: Record<WaterfallStepKey, string> = {
  savings: "bg-sky-500",
  essentials: "bg-amber-500",
  discretionary: "bg-[hsl(var(--brand))]",
  surplus: "bg-emerald-500",
};

const STEP_HINT: Record<WaterfallStepKey, string> = {
  savings: "Pay-yourself-first",
  essentials: "existenzsichernd",
  discretionary: "Null-Saldo",
  surplus: "frei für Sparen/Investieren",
};

/** Eine Wasserfall-Stufe: Betrag zählt hoch, Balken baut sich auf (baseline-konform). */
function StepRow({ step, income, animate }: { step: WaterfallStep; income: number; animate: boolean }) {
  const targetPct = income > 0 ? Math.min(100, (step.allocated / income) * 100) : 0;
  const [width, setWidth] = useState(animate ? 0 : targetPct);
  const shownAmount = useAnimatedNumber(step.allocated, { enabled: animate });

  // Aufbau: Balken wächst beim Mount von 0 → Ziel (kein Aufpoppen).
  useEffect(() => {
    if (!animate) {
      setWidth(targetPct);
      return;
    }
    const raf = requestAnimationFrame(() => setWidth(targetPct));
    return () => cancelAnimationFrame(raf);
  }, [targetPct, animate]);

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">
          {step.label}
          <span className="ml-2 text-xs font-normal text-muted-foreground">{STEP_HINT[step.key]}</span>
        </span>
        <span className="tabular-nums font-semibold">{eur.format(shownAmount)}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", STEP_FILL[step.key], animate && "transition-[width] duration-700 ease-out")}
          style={{ width: `${width}%` }}
        />
      </div>
      {!step.funded && step.shortfall > 0 && (
        <div className="text-xs text-red-600 dark:text-red-400">
          {eur.format(step.shortfall)} nicht gedeckt
        </div>
      )}
    </div>
  );
}

/**
 * Liquiditäts-Wasserfall: zeigt, wie sich das (reale) Monatseinkommen kaskadierend
 * verteilt – Sparen zuerst, dann Fixkosten, dann variable Töpfe (Null-Saldo),
 * Rest als Überschuss. Datengetrieben (Median der letzten Monate) und mit
 * Aufbau-Animation; bei prefers-reduced-motion direkt im Zielzustand.
 */
export default function WaterfallPanel() {
  const animate = !useReducedMotion();
  const { data: plan, isLoading } = useQuery({ queryKey: ["waterfall-plan"], queryFn: () => getWaterfallPlan() });

  if (isLoading || !plan) return null;
  if (plan.income <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Waves className="h-4 w-4 text-[hsl(var(--brand))]" /> Liquiditäts-Wasserfall
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Noch kein regelmäßiges Einkommen erkannt. Sobald Einnahmen kategorisiert sind, zeigen wir hier deine
          Mittelverteilung.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
          <Waves className="h-4 w-4 text-[hsl(var(--brand))]" /> Liquiditäts-Wasserfall
          <span className="text-xs font-normal text-muted-foreground">
            Einkommen {eur.format(plan.income)} · Sparquote {Math.round(plan.savingsRate * 100)}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!plan.feasible && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Sparquote zu hoch: Nach dem Sparen bleiben die Fixkosten unterdeckt. Reduziere die Sparquote oder
              senke Fixkosten.
            </span>
          </div>
        )}

        <div className="space-y-3">
          {plan.steps.map((step) => (
            <StepRow key={step.key} step={step} income={plan.income} animate={animate} />
          ))}
        </div>

        {plan.monthsAnalyzed < 3 && (
          <p className="text-xs text-muted-foreground">
            Basis: erst {plan.monthsAnalyzed} Monat(e) Daten – die Schätzung wird mit der Zeit genauer.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
