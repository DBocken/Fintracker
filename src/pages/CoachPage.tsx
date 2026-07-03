import PageHeader from "@/components/common/PageHeader";
import FinancialLandscape from "@/components/health-score/FinancialLandscape";
import FinanceEmptyState from "@/components/common/FinanceEmptyState";
import CoachDesktopView from "@/components/coach/CoachDesktopView";
import CoachMobileView from "@/components/coach/CoachMobileView";
import { useCoachOverview } from "@/hooks/data/useCoachOverview";
import { useLayoutMode } from "@/components/providers/LayoutModeProvider";
import { useI18n } from "@/i18n/useI18n";
import type { CoachViewProps } from "@/components/coach/coach-view";

/**
 * Orchestrator des Coach-Screens: beschafft die Daten EINMAL (über
 * `useCoachOverview`), behandelt den gemeinsamen Leerzustand und mountet dann
 * per `useLayoutMode()` GENAU EINE Darstellungsvariante. Kein CSS-Doppelrender
 * mehr — der inaktive Baum wird nie gemountet.
 */
export default function CoachPage() {
  const { t } = useI18n();
  const { mode } = useLayoutMode();
  const { coach, health, milestones, hasData, coachLoading, milestonesLoading } = useCoachOverview();

  // Leerer Zustand (Issue #39): ohne Daten gibt es nichts zu coachen — klare
  // nächste Aktion statt leerer Karten. Gilt für beide Darstellungsmodi.
  if (hasData === false) {
    return (
      <div className="space-y-8">
        <PageHeader title={t("coach.title")} description={t("coach.description")} />
        <FinancialLandscape health={health} variant="strip" />
        <FinanceEmptyState />
      </div>
    );
  }

  const recommendations = coach?.recommendations ?? [];
  const viewProps: CoachViewProps = {
    coach,
    health,
    milestones,
    focusCard: recommendations[0],
    followUps: recommendations.slice(1),
    coachLoading,
    milestonesLoading,
  };

  return mode === "mobile" ? <CoachMobileView {...viewProps} /> : <CoachDesktopView {...viewProps} />;
}
