import { lazy, Suspense } from "react";
import FinanceEmptyState from "@/features/shared/presentation/FinanceEmptyState";
import FinanceErrorState from "@/features/shared/presentation/FinanceErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useDisplayDensity } from "@/hooks/useDisplayDensity";
import { useFinanceOverview } from "@/features/dashboard/application/use-finance-overview";

const AuswertungenKompakt = lazy(
  () => import("@/features/dashboard/presentation/mobile/DashboardMobileStory"),
);
const AuswertungenFokussiert = lazy(
  () => import("@/features/dashboard/presentation/mobile/AuswertungenFokussiert"),
);

/**
 * Die Auswertungen — eine Fläche, mehrere Ansichten, zum Wischen.
 *
 * **Warum sie eine eigene Seite ist.** Sie steckte bis hierher am unteren Ende
 * der Übersicht: Diagramme mit Registerleiste und Wischgeste, erreichbar erst
 * nach drei Bildschirmlängen Vorspann aus Kontostand, Stadt-Verweis,
 * Coach-Verweis, Suchfeld, Filter und Kennzahlen. Das Beste der Fläche lag
 * unter dem Schlechtesten begraben.
 *
 * Oben steht jetzt die Frage „wohin ist mein Geld gegangen" in drei Aussagen
 * (`/dashboard`), und wer es genauer wissen will, landet hier — auf einer
 * Fläche, die nichts anderes tut. Jede Ansicht ist über `?view=` adressierbar.
 *
 * **Zwei Präsentationen, eine gemountet** (ADR Regel 6). Die fokussierte
 * Fassung ist nicht die kompakte in schmal: Sie trägt je Ansicht genau eine
 * Visualisierung ohne Rahmen, während die kompakte weiterhin die
 * kartenbasierten Bausteine zeigt, für die auf einem breiten Bildschirm Platz
 * ist.
 *
 * **Die Reihenfolge der Zustände ist die Aussage.** Fehler geht vor
 * Leerzustand: Nach einem Lesefehler „du hast noch nichts" zu sagen, fordert
 * zum Neuerfassen von Daten auf, die längst da sind.
 */
export default function AuswertungenPage() {
  const model = useFinanceOverview();
  const dichte = useDisplayDensity();

  if (model.hasError) return <FinanceErrorState onRetry={model.actions.reload} />;
  if (model.loading) return <Skeleton variant="shimmer" className="h-64 w-full rounded-lg" />;
  if (model.isEmpty) return <FinanceEmptyState />;

  return (
    <Suspense fallback={<Skeleton variant="shimmer" className="h-64 w-full rounded-lg" />}>
      {dichte === "fokussiert" ? (
        <AuswertungenFokussiert model={model} />
      ) : (
        <AuswertungenKompakt model={model} />
      )}
    </Suspense>
  );
}
