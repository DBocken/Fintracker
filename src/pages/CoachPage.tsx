import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BarChart3, ArrowRight, Sparkles } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import HealthScoreCard from "@/components/health-score/HealthScoreCard";
import CoachFeedCard from "@/components/coach/CoachFeedCard";
import MilestonesStrip from "@/components/milestones/MilestonesStrip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCoachOverview } from "@/services/coach-service";
import { getFinancialHealth } from "@/services/financial-health-service";
import { evaluateMilestones } from "@/services/milestones-service";
import { getTransactions } from "@/services/transaction-service";
import { getDebts } from "@/services/debt-service";
import FinanceEmptyState from "@/components/common/FinanceEmptyState";

export default function CoachPage() {
  const { data: coach, isLoading: coachLoading } = useQuery({ queryKey: ["coach-overview"], queryFn: getCoachOverview });
  const { data: health } = useQuery({ queryKey: ["financial-health"], queryFn: getFinancialHealth });
  const { data: milestones, isLoading: milestonesLoading } = useQuery({ queryKey: ["milestones"], queryFn: evaluateMilestones });

  // Leerer Zustand (Issue #39): ohne Daten gibt es nichts zu coachen —
  // klare nächste Aktion statt leerer Karten. Eigener queryKey, damit der
  // Transactions-Cache des Dashboards (Limit 5000) nicht verfälscht wird.
  const { data: hasData } = useQuery({
    queryKey: ["has-finance-data"],
    queryFn: async () => {
      const [txs, debts] = await Promise.all([getTransactions(1), getDebts()]);
      return txs.length > 0 || debts.length > 0;
    },
  });

  if (hasData === false) {
    return (
      <div className="space-y-8">
        <PageHeader title="Heute für dich" description="Dein Finanzcoach zeigt dir die nächste beste Entscheidung zuerst." />
        <FinanceEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Heute für dich" description="Dein Finanzcoach zeigt dir die nächste beste Entscheidung zuerst." />

      {coachLoading ? <Skeleton className="h-36 w-full rounded-2xl" /> : coach && health ? <HealthScoreCard health={health} /> : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          Priorität jetzt
        </div>
        {coachLoading ? (
          <div className="space-y-3"><Skeleton className="h-24 w-full rounded-2xl" /><Skeleton className="h-24 w-full rounded-2xl" /></div>
        ) : (
          <div className="space-y-3">
            {coach?.recommendations.map((card, i) => <CoachFeedCard key={card.id} card={card} index={i} />)}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="text-sm text-muted-foreground">Roadmap-Status</div>
          <div className="mt-2 text-xl font-semibold">{coach?.stage.title}</div>
          <p className="mt-2 text-sm text-muted-foreground">{coach?.stage.description}</p>
          <p className="mt-3 text-sm">{coach?.stage.whyItMatters}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="text-sm text-muted-foreground">Schuldenkontext</div>
          <div className="mt-2 text-xl font-semibold">{coach?.debtSummary.totalDebt.toFixed(0)} € offen</div>
          <p className="mt-2 text-sm text-muted-foreground">Mindestraten: {coach?.debtSummary.minimumMonthlyBurden.toFixed(0)} € / Monat</p>
          <p className="mt-3 text-sm">Schneller ist aktuell: {coach?.debtSummary.preferredStrategy === "avalanche" ? "Lawine (höchster Zins zuerst)" : "Schneeball (kleinste Schuld zuerst)"}</p>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          🏆 Deine Meilensteine
        </div>
        {milestonesLoading ? <Skeleton className="h-24 w-full rounded-2xl" /> : milestones ? <MilestonesStrip milestones={milestones} /> : null}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            Details & Charts
          </div>
          <Button asChild variant="ghost" size="sm"><Link to="/dashboard">Zum Dashboard<ArrowRight className="ml-1.5 h-4 w-4" /></Link></Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Das Dashboard bleibt dein Analyse-Support für Charts, Transaktionen und Filter.</p>
      </section>
    </div>
  );
}