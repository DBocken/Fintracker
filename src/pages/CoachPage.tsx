import PageHeader from "@/features/shared/presentation/PageHeader";
import FinancialLandscape from "@/features/shared/presentation/FinancialLandscape";
import FinanceEmptyState from "@/features/shared/presentation/FinanceEmptyState";
import FinanceErrorState from "@/features/shared/presentation/FinanceErrorState";
import { useCoachOverview } from "@/features/coach/application/use-coach-overview";
import CoachDesktopView from "@/features/coach/presentation/desktop/CoachDesktopView";
import CoachMobileToday from "@/features/coach/presentation/mobile/CoachMobileToday";
import { useI18n } from "@/i18n/useI18n";

/**
 * Dünner Routen-Einstieg (§3). Daten und fachliche Rangfolge kommen aus
 * `useCoachOverview()`, die Darstellung aus je einer Präsentation für Desktop
 * und Telefon — beide auf demselben ViewModel (§4).
 *
 * **Die Reihenfolge der drei Zustände ist die Aussage.** Fehler geht vor
 * Leerzustand: Nach einem Lesefehler „fang mal an" zu sagen, fordert zum
 * Neuerfassen von Daten auf, die längst da sind — die teuerste Form der
 * falschen Auskunft auf der Einstiegsfläche der App.
 */
export default function CoachPage() {
  const { t } = useI18n();
  const model = useCoachOverview();

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
    <>
      {/* Desktop: informationsreich, alles gleichzeitig sichtbar. Der
          Seitenkopf steht nur hier — mobil trägt die Fläche ihren eigenen,
          kompakten Kopf mit Score, damit die Hauptaussage im ersten
          Bildschirm bleibt (§4, Inhaltsrang). */}
      <div className="hidden space-y-5 sm:space-y-8 lg:block">
        <PageHeader title={t("coach.title")} description={t("coach.description")} />
        <CoachDesktopView model={model} />
      </div>

      {/* Telefon/Tablet hochkant: eine Hauptaussage, alles Übrige in vier
          adressierbaren Ansichten. */}
      <div className="lg:hidden">
        <CoachMobileToday model={model} />
      </div>
    </>
  );
}
