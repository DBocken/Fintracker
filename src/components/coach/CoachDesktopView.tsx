import { Link } from "react-router-dom";
import { BarChart3, ArrowRight, Sparkles, CheckCircle2, PartyPopper, CalendarClock } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import HealthScoreCard from "@/components/health-score/HealthScoreCard";
import FinancialLandscape from "@/components/health-score/FinancialLandscape";
import CoachFeedCard from "@/components/coach/CoachFeedCard";
import CoachStatusGrid from "@/components/coach/CoachStatusGrid";
import FoundationLadder from "@/components/coach/FoundationLadder";
import DisposableTankCard from "@/components/coach/DisposableTankCard";
import UpcomingChargesList from "@/components/coach/UpcomingChargesList";
import CategorySuggestionsInbox from "@/components/coach/CategorySuggestionsInbox";
import MilestonesStrip from "@/components/milestones/MilestonesStrip";
import SectionHeader from "@/components/common/SectionHeader";
import InteractiveCard from "@/components/common/InteractiveCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGentleMode } from "@/components/providers/GentleModeProvider";
import { useI18n } from "@/i18n/useI18n";
import type { CoachViewProps } from "@/components/coach/coach-view";

/**
 * Desktop-Variante des Coach-Screens: dichtes, vollständiges Layout — alle
 * Bereiche gleichzeitig sichtbar. Enthält keinen Datenzugriff; alle Daten kommen
 * als Props vom Orchestrator (`CoachPage`).
 */
export default function CoachDesktopView({
  coach,
  health,
  milestones,
  focusCard,
  followUps,
  coachLoading,
  milestonesLoading,
}: CoachViewProps) {
  const { t } = useI18n();
  const { enabled: gentleModeEnabled } = useGentleMode();

  return (
    <div className="space-y-5 sm:space-y-8" data-testid="coach-desktop">
      <PageHeader title={t("coach.title")} description={t("coach.description")} />

      {/* Fokuskarte zuerst (Audit P1.4): der priorisierte nächste Schritt steht
          ganz oben; darunter ein glanceable 2×2-Statusraster mit Details per Tap. */}
      <section className="space-y-4">
        <SectionHeader icon={<Sparkles className="h-4 w-4" />} title={t("coach.priorityNow")} />
        {coachLoading ? (
          <Skeleton className="h-32 w-full rounded-2xl" />
        ) : focusCard ? (
          <CoachFeedCard card={focusCard} index={0} featured />
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-positive/20 bg-positive/5 p-4 shadow-sm">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-positive" />
            <div>
              <div className="font-semibold">{t("coach.allGood")}</div>
              <p className="mt-1 text-sm text-muted-foreground">{t("coach.noRecommendations")}</p>
            </div>
          </div>
        )}

        {health ? (
          <CoachStatusGrid health={health} gentle={gentleModeEnabled} />
        ) : (
          <Skeleton className="h-44 w-full rounded-2xl" />
        )}
      </section>

      {/* Offene Kategorie-Vorschläge bestätigen (bleibt unsichtbar, wenn leer). */}
      <CategorySuggestionsInbox />

      {/* Vor dem nächsten Gehalt: was bleibt frei (Tank, klickbar → Liquidität)
          und welche Abbuchungen kommen als Nächstes (reines Readout). */}
      <section className="space-y-4">
        <SectionHeader icon={<CalendarClock className="h-4 w-4" />} title="Vor dem nächsten Gehalt" />
        <DisposableTankCard />
        <UpcomingChargesList />
      </section>

      <FoundationLadder />

      {/* Reichere Illustration + Score nebeneinander. */}
      <div className="lg:flex lg:items-start lg:gap-4">
        <div className="shrink-0 lg:w-80 xl:w-[416px]">
          <FinancialLandscape health={health} variant="hero" />
        </div>
        <div className="min-w-0 lg:flex-1">
          {coachLoading ? (
            <Skeleton className="h-36 w-full rounded-2xl" />
          ) : coach && health ? (
            <HealthScoreCard health={health} />
          ) : null}
        </div>
      </div>

      {followUps.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title={t("coach.moreRecommendations")} />
          <div className="space-y-3">
            {followUps.map((card, i) => (
              <CoachFeedCard key={card.id} card={card} index={i + 1} />
            ))}
          </div>
        </section>
      )}

      {/* Roadmap-Status & Schuldenkontext: klickbare Karten (Usability-Audit
          „Karten sind Aktionen") – ganze Fläche navigiert zu Meilensteinen
          bzw. Schulden/Nettovermögen statt nur Information zu zeigen. */}
      <section className="grid gap-4 md:grid-cols-2">
        <InteractiveCard to="/milestones" aria-label={t("coach.roadmapStatusAction")}>
          <div className="text-sm text-muted-foreground">{t("coach.roadmapStatus")}</div>
          <div className="mt-2 text-xl font-semibold">{coach?.stage.title}</div>
          <p className="mt-2 text-sm text-muted-foreground">{coach?.stage.description}</p>
          <p className="mt-3 text-sm">{coach?.stage.whyItMatters}</p>
        </InteractiveCard>
        {coach && coach.debtSummary.totalDebt > 0 ? (
          <InteractiveCard to="/debts" aria-label={t("coach.debtContextAction")}>
            <div className="text-sm text-muted-foreground">{t("coach.debtContext")}</div>
            <div className="mt-2 text-xl font-semibold">
              {gentleModeEnabled ? "*** " + t("coach.openDebt") : `${coach.debtSummary.totalDebt.toFixed(0)} ` + t("coach.openDebt")}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("coach.minimumPayment")}: {gentleModeEnabled ? "***" : `${coach.debtSummary.minimumMonthlyBurden.toFixed(0)}`} {t("coach.perMonth")}
            </p>
            <p className="mt-3 text-sm">{t("coach.fasterStrategy")}: {coach.debtSummary.preferredStrategy === "avalanche" ? t("coach.avalanche") : t("coach.snowball")}</p>
          </InteractiveCard>
        ) : (
          <InteractiveCard
            to="/net-worth"
            aria-label={t("coach.viewNetWorth")}
            className="border-positive/20 bg-positive/5 hover:bg-positive/10"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <PartyPopper className="h-4 w-4 text-positive" />
              {t("coach.debtContext")}
            </div>
            <div className="mt-2 text-xl font-semibold">{t("coach.debtFree")}</div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("coach.debtFreeDescription")}
            </p>
          </InteractiveCard>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader
          title={t("coach.yourMilestones")}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/milestones">{t("coach.viewAll")}<ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
          }
        />
        {milestonesLoading ? <Skeleton className="h-24 w-full rounded-2xl" /> : milestones ? <MilestonesStrip milestones={milestones} variant="compact" /> : null}
      </section>

      <section className="space-y-2">
        <SectionHeader
          icon={<BarChart3 className="h-4 w-4" />}
          title={t("coach.detailsAndCharts")}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard">{t("coach.viewAllExpenses")}<ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
          }
        />
        <p className="text-sm text-muted-foreground">{t("coach.dashboardSupport")}</p>
      </section>
    </div>
  );
}
