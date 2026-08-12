import PageHeader from "@/features/shared/presentation/PageHeader";
import TutorialsOverview from "@/features/tutorials/presentation/TutorialsOverview";
import { useI18n } from "@/i18n/useI18n";

/**
 * Dünner Routen-Einstieg (AGENTS.md §3) — Inhalt und Datenbeschaffung liegen
 * in der Slice `src/features/tutorials/`.
 */
export default function TutorialsPage() {
  const { t } = useI18n();

  return (
    <div>
      <PageHeader title={t("tutorials.title")} description={t("tutorials.description")} />
      <TutorialsOverview />
    </div>
  );
}
