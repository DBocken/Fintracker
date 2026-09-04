import { Suspense, lazy } from "react";
import PageHeader from "@/features/shared/presentation/PageHeader";
import FinancialLandscape from "@/features/shared/presentation/FinancialLandscape";
import FinanceEmptyState from "@/features/shared/presentation/FinanceEmptyState";
import FinanceErrorState from "@/features/shared/presentation/FinanceErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useCoachOverview } from "@/features/coach/application/use-coach-overview";
import { useDisplayDensity } from "@/hooks/useDisplayDensity";
import { useI18n } from "@/i18n/useI18n";

/**
 * Nur die gewählte Dichte wird geladen (ADR `darstellungsdichte.md` Regel 6).
 *
 * Vorher standen beide Fassungen im Baum und eine wurde per `hidden lg:block`
 * weggeblendet. Das war billig, solange es drei Flächen betraf; über 25
 * bedeutet es doppeltes DOM, doppelte Recharts-Instanzen und beide Fassungen
 * im Bündel — auf genau dem Gerät mit der wenigsten Luft.
 */
const CoachDesktopView = lazy(() => import("@/features/coach/presentation/desktop/CoachDesktopView"));
const CoachFokussiert = lazy(() => import("@/features/coach/presentation/mobile/CoachFokussiert"));

/**
 * Dünner Routen-Einstieg (§3). Daten und fachliche Rangfolge kommen aus
 * `useCoachOverview()`, die Darstellung aus je einer Präsentation je Dichte.
 *
 * **Die Reihenfolge der drei Zustände ist die Aussage.** Fehler geht vor
 * Leerzustand: Nach einem Lesefehler „fang mal an" zu sagen, fordert zum
 * Neuerfassen von Daten auf, die längst da sind — die teuerste Form der
 * falschen Auskunft auf der Einstiegsfläche der App.
 */
export default function CoachPage() {
  const { t } = useI18n();
  const model = useCoachOverview();
  const density = useDisplayDensity();

  if (model.hasError) {
    return (
      <div className="space-y-8">
        <PageHeader title={t("coach.title")} description={t("coach.description")} />
        <FinanceErrorState onRetry={model.retry} />
      </div>
    );
  }

  if (model.isEmpty) {
    return (
      <div className="space-y-8">
        <PageHeader title={t("coach.title")} description={t("coach.description")} />
        <FinancialLandscape health={model.health} variant="strip" />
        <FinanceEmptyState />
      </div>
    );
  }

  return (
    <Suspense fallback={<Skeleton variant="shimmer" className="h-64 w-full rounded-lg" />}>
      {density === "fokussiert" ? (
        // Der Seitenkopf steht hier NICHT: Die fokussierte Fassung trägt ihren
        // Namen im Inhalt (ADR Regel 9 — ein Bildschirm, drei Aussagen).
        <CoachFokussiert model={model} />
      ) : (
        <div className="space-y-5 sm:space-y-8">
          <PageHeader title={t("coach.title")} description={t("coach.description")} />
          <CoachDesktopView model={model} />
        </div>
      )}
    </Suspense>
  );
}
