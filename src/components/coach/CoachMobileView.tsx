import { Sparkles, CheckCircle2, CalendarClock } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import FinancialLandscape from "@/components/health-score/FinancialLandscape";
import CoachFeedCard from "@/components/coach/CoachFeedCard";
import CoachStatusGrid from "@/components/coach/CoachStatusGrid";
import FoundationLadder from "@/components/coach/FoundationLadder";
import DisposableTankCard from "@/components/coach/DisposableTankCard";
import UpcomingChargesList from "@/components/coach/UpcomingChargesList";
import CategorySuggestionsInbox from "@/components/coach/CategorySuggestionsInbox";
import SectionHeader from "@/components/common/SectionHeader";
import InteractiveCard from "@/components/common/InteractiveCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useGentleMode } from "@/components/providers/GentleModeProvider";
import { useI18n } from "@/i18n/useI18n";
import type { CoachViewProps } from "@/components/coach/coach-view";

/**
 * Mobile-Variante des Coach-Screens — der Hub im Hub-and-Spoke-Modell und
 * bewusst nach Progressive Disclosure (3 Ebenen) aufgebaut:
 *
 *  - Ebene 1: EINE Kernaussage, ohne Scrollen erfassbar (Fokuskarte bzw.
 *    „alles im grünen Bereich") + glanceable Statusraster.
 *  - Ebene 2: Treiber & Belege einen Tap entfernt — Details je Kachel als
 *    Bottom-Sheet (im StatusGrid) sowie aufklappbare Abschnitte (Accordion).
 *  - Ebene 3: bewusst aufgesucht — Spokes verlinken zu den Vollansichten
 *    (Liquidität, Schulden, Nettovermögen, Meilensteine, Dashboard). Von dort
 *    führt die Navigation zurück zum Hub, nicht quer zwischen Spokes.
 *
 * Enthält keinen Datenzugriff; alle Daten kommen als Props vom Orchestrator.
 */
export default function CoachMobileView({
  coach,
  health,
  focusCard,
  followUps,
  coachLoading,
}: CoachViewProps) {
  const { t } = useI18n();
  const { enabled: gentleModeEnabled } = useGentleMode();

  const hasDebt = !!coach && coach.debtSummary.totalDebt > 0;

  return (
    <div className="space-y-6" data-testid="coach-mobile">
      <PageHeader title={t("coach.title")} description={t("coach.description")} />

      {/* ── Ebene 1: EINE Kernaussage ─────────────────────────────────────── */}
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

        {/* Glanceable Statusraster — Details je Kachel per Tap (Ebene 2 inline). */}
        {health ? (
          <CoachStatusGrid health={health} gentle={gentleModeEnabled} />
        ) : (
          <Skeleton className="h-44 w-full rounded-2xl" />
        )}
      </section>

      {/* Offene Kategorie-Vorschläge (bleibt unsichtbar, wenn leer). */}
      <CategorySuggestionsInbox />

      {/* ── Ebene 2: Treiber & Belege — einen Tap entfernt (aufklappbar) ───── */}
      <Accordion type="single" collapsible className="space-y-3">
        <AccordionItem value="paycheck" className="ds-section overflow-hidden">
          <AccordionTrigger className="px-4">
            <span className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Vor dem nächsten Gehalt
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 px-4">
            <DisposableTankCard />
            <UpcomingChargesList />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="foundation" className="ds-section overflow-hidden">
          <AccordionTrigger className="px-4">{t("coach.roadmapStatus")}</AccordionTrigger>
          <AccordionContent className="px-4">
            <FoundationLadder />
          </AccordionContent>
        </AccordionItem>

        {followUps.length > 0 && (
          <AccordionItem value="more" className="ds-section overflow-hidden">
            <AccordionTrigger className="px-4">{t("coach.moreRecommendations")}</AccordionTrigger>
            <AccordionContent className="space-y-3 px-4">
              {followUps.map((card, i) => (
                <CoachFeedCard key={card.id} card={card} index={i + 1} />
              ))}
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Kompakte Illustration + Score, ruhig gebündelt. */}
      <div className="mx-auto w-full max-w-xs">
        <FinancialLandscape health={health} variant="hero-compact" />
      </div>

      {/* ── Ebene 3: Spokes — bewusst aufgesuchte Vollansichten ────────────── */}
      <section className="space-y-3">
        <SectionHeader title={t("coach.detailsAndCharts")} />
        <div className="space-y-3">
          <InteractiveCard to="/liquidity" aria-label={t("nav.items.liquidity")}>
            <SpokeLabel title={t("nav.items.liquidity")} hint={t("nav.subtitles.liquidity")} />
          </InteractiveCard>

          {hasDebt ? (
            <InteractiveCard to="/debts" aria-label={t("coach.debtContextAction")}>
              <SpokeLabel
                title={t("nav.items.debts")}
                hint={
                  gentleModeEnabled
                    ? `*** ${t("coach.openDebt")}`
                    : `${coach!.debtSummary.totalDebt.toFixed(0)} ${t("coach.openDebt")}`
                }
              />
            </InteractiveCard>
          ) : (
            <InteractiveCard to="/net-worth" aria-label={t("coach.viewNetWorth")}>
              <SpokeLabel title={t("nav.items.netWorth")} hint={t("coach.debtFree")} />
            </InteractiveCard>
          )}

          <InteractiveCard to="/milestones" aria-label={t("coach.yourMilestones")}>
            <SpokeLabel title={t("coach.yourMilestones")} hint={coach?.stage.title} />
          </InteractiveCard>

          <InteractiveCard to="/dashboard" aria-label={t("coach.viewAllExpenses")}>
            <SpokeLabel title={t("coach.detailsAndCharts")} hint={t("coach.dashboardSupport")} />
          </InteractiveCard>
        </div>
      </section>
    </div>
  );
}

/**
 * Beschriftung einer Spoke-Karte: Titel + optionaler Hinweis. Die Affordanz
 * (Chevron, Hover, Fokusring, ≥44px Touch-Ziel) liefert die umschließende
 * `InteractiveCard` — hier bewusst KEIN eigener Pfeil (sonst doppelt).
 */
function SpokeLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="font-semibold">{title}</div>
      {hint ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
