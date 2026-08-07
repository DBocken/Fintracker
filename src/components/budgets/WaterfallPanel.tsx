import { useEffect, useState } from "react";
import { AlertTriangle, Waves } from "lucide-react";
import { InfoGroup } from "@/components/common/InfoGroup";
import FinanceErrorState from "@/components/common/FinanceErrorState";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { useI18n } from "@/i18n/useI18n";
import { useWaterfallPlan } from "@/hooks/useWaterfallPlan";
import type { WaterfallStep, WaterfallStepKey } from "@/lib/budget-waterfall";
import { cn } from "@/lib/utils";
import { useMoneyFormat } from '@/hooks/useMoneyFormat';

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const STEP_FILL: Record<WaterfallStepKey, string> = {
  "tax-reserve": "bg-violet-500",
  savings: "bg-sky-500",
  essentials: "bg-amber-500",
  discretionary: "bg-[hsl(var(--brand))]",
  surplus: "bg-emerald-500",
};

/** Eine Wasserfall-Stufe: Betrag zählt hoch, Balken baut sich auf (baseline-konform). */
function StepRow({ step, income, animate, stepHints }: { step: WaterfallStep; income: number; animate: boolean; stepHints: Record<WaterfallStepKey, string> }) {
  const money = useMoneyFormat();
  const { t } = useI18n();
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
          <span className="ml-2 text-xs font-normal text-muted-foreground">{stepHints[step.key]}</span>
        </span>
        <span className="tabular-nums font-semibold">{money.mask(eur.format(shownAmount))}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", STEP_FILL[step.key], animate && "transition-[width] duration-700 ease-out")}
          style={{ width: `${width}%` }}
        />
      </div>
      {!step.funded && step.shortfall > 0 && (
        <div className="text-xs text-red-600 dark:text-red-400">
          {money.mask(eur.format(step.shortfall))} {t('budgets.waterfall.notCovered')}
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
  const money = useMoneyFormat();
  const { t } = useI18n();
  const animate = !useReducedMotion();
  const { plan, isLoading, isError, refetch } = useWaterfallPlan();

  // WP-9.6: „nicht ladbar" ist nicht „kein Einkommen erfasst". Ohne diesen
  // Zweig faellt ein Lesefehler in den Hinweis „noch kein Einkommen" — eine
  // Aussage ueber die Daten, die gar nicht gelesen werden konnten.
  if (isError) {
    return <FinanceErrorState variant="data" onRetry={() => void refetch()} />;
  }

  // Kein eigener Ladezustand mehr: Auf /liquidity wartet die SEITE auf denselben
  // Plan und rendert erst dann (WP-10.4, siehe `useWaterfallPlan`). Ein Skelett
  // hier waere ein zweiter, hoehenabweichender Zwischenzustand — genau die
  // Verschiebung, die dort beseitigt wurde.
  if (isLoading || !plan) return null;
  if (plan.income <= 0) {
    return (
      <InfoGroup
        title={
          <span className="flex items-center gap-2 text-base">
            <Waves className="h-4 w-4 text-[hsl(var(--brand))]" /> {t('budgets.waterfall.title')}
          </span>
        }
      >
        <p className="text-sm text-muted-foreground">{t('budgets.waterfall.noIncome')}</p>
      </InfoGroup>
    );
  }

  const stepHints: Record<WaterfallStepKey, string> = {
    'tax-reserve': t('budgets.waterfall.stepHints.taxReserve'),
    savings: t('budgets.waterfall.stepHints.savings'),
    essentials: t('budgets.waterfall.stepHints.essentials'),
    discretionary: t('budgets.waterfall.stepHints.discretionary'),
    surplus: t('budgets.waterfall.stepHints.surplus'),
  };

  return (
    // WP-8.1: Karten-los (AGENTS.md Paragraf 9). Der Wasserfall erklaert, wie
    // sich das Einkommen verteilt — ein Readout ohne Follow-up, in dem nichts
    // anklickbar ist.
    <InfoGroup
      className="space-y-4"
      title={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
          <Waves className="h-4 w-4 text-[hsl(var(--brand))]" /> {t('budgets.waterfall.title')}
          <span className="text-xs font-normal text-muted-foreground">
            {t('budgets.waterfall.income')} {money.mask(eur.format(plan.income))} · {t('budgets.waterfall.savingsRate')} {Math.round(plan.savingsRate * 100)}%
          </span>
        </span>
      }
    >
        {!plan.feasible && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {t('budgets.waterfall.highSavingsRateWarning')}
            </span>
          </div>
        )}

        <div className="space-y-3">
          {plan.steps.map((step) => (
            <StepRow key={step.key} step={step} income={plan.income} animate={animate} stepHints={stepHints} />
          ))}
        </div>

        {plan.monthsAnalyzed < 3 && (
          <p className="text-xs text-muted-foreground">
            {t('budgets.waterfall.insufficientData').replace('{months}', String(plan.monthsAnalyzed))}
          </p>
        )}
    </InfoGroup>
  );
}
