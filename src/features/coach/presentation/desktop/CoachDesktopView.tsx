import { Link } from "react-router-dom";
import { BarChart3, ArrowRight, Sparkles, CheckCircle2, PartyPopper, CalendarClock } from "lucide-react";
import HealthScoreCard from "@/features/coach/presentation/shared/HealthScoreCard";
import FinancialLandscape from "@/features/shared/presentation/FinancialLandscape";
import CoachFeedCard from "@/features/coach/presentation/shared/CoachFeedCard";
import CoachStatusGrid from "@/features/coach/presentation/shared/CoachStatusGrid";
import FoundationLadder from "@/features/coach/presentation/shared/FoundationLadder";
import DisposableTankCard from "@/features/coach/presentation/shared/DisposableTankCard";
import UpcomingChargesList from "@/features/coach/presentation/shared/UpcomingChargesList";
import CategorySuggestionsInbox from "@/features/coach/presentation/shared/CategorySuggestionsInbox";
import MilestonesStrip from "@/features/shared/presentation/MilestonesStrip";
import SectionHeader from "@/features/shared/presentation/SectionHeader";
import InteractiveCard from "@/features/shared/presentation/InteractiveCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMoneyFormat } from "@/hooks/useMoneyFormat";
import { useI18n } from "@/i18n/useI18n";
import type { CoachViewModel } from "../../application/coach-overview-view-model";

/**
 * Desktop-Präsentation der Coach-Fläche: informationsreich, alles gleichzeitig
 * sichtbar — der grosse Bildschirm ist der Vorteil, den sie ausspielt.
 *
 * Inhaltlich unverändert gegenüber der Fassung, die bis zur Slice-Migration
 * direkt in `src/pages/CoachPage.tsx` stand; einziger Unterschied ist die
 * Herkunft der Daten (`model` statt eigener Abfragen).
 */
export default function CoachDesktopView({ model }: { model: CoachViewModel }) {
  const { t } = useI18n();
  const money = useMoneyFormat();
  const { coach, health, milestones, milestonesLoading, focus, followUps, hasDebt, loading } = model;

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* Fokuskarte zuerst (Audit P1.4): der priorisierte nächste Schritt steht
          ganz oben; darunter ein glanceable 2×2-Statusraster mit Details per Tap. */}
      <section className="space-y-4">
        <SectionHeader icon={<Sparkles className="h-4 w-4" />} title={t("coach.priorityNow")} />
        {loading ? (
          <Skeleton variant="shimmer" className="h-32 w-full rounded-2xl" />
        ) : focus ? (
          <CoachFeedCard card={focus} index={0} featured />
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
          <CoachStatusGrid health={health} />
        ) : (
          <Skeleton variant="shimmer" className="h-44 w-full rounded-2xl" />
        )}
      </section>

      {/* Offene Kategorie-Vorschläge bestätigen (bleibt unsichtbar, wenn leer). */}
      <CategorySuggestionsInbox />

      {/* Vor dem nächsten Gehalt: was bleibt frei (Tank, klickbar → Liquidität)
          und welche Abbuchungen kommen als Nächstes (reines Readout). */}
      <section className="space-y-4">
        <SectionHeader icon={<CalendarClock className="h-4 w-4" />} title={t("coach.nextPayday")} />
        <DisposableTankCard />
        <UpcomingChargesList />
      </section>

      <FoundationLadder />

      <div className="space-y-4 lg:flex lg:items-start lg:gap-4 lg:space-y-0">
        <div className="hidden shrink-0 lg:block lg:w-80 xl:w-[416px]">
          <FinancialLandscape health={health} variant="hero" />
        </div>
        <div className="min-w-0 lg:flex-1">
          {loading ? (
            <Skeleton variant="shimmer" className="h-36 w-full rounded-2xl" />
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
        {coach && hasDebt ? (
          <InteractiveCard to="/debts" aria-label={t("coach.debtContextAction")}>
            <div className="text-sm text-muted-foreground">{t("coach.debtContext")}</div>
            <div className="mt-2 text-xl font-semibold">
              {money.mask(coach.debtSummary.totalDebt.toFixed(0))} {t("coach.openDebt")}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("coach.minimumPayment")}: {money.mask(coach.debtSummary.minimumMonthlyBurden.toFixed(0))} {t("coach.perMonth")}
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
        {milestonesLoading ? <Skeleton variant="shimmer" className="h-24 w-full rounded-2xl" /> : milestones ? <MilestonesStrip milestones={milestones} variant="compact" /> : null}
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
