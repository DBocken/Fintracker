import FinanceEmptyState from "@/features/shared/presentation/FinanceEmptyState";
import FinanceErrorState from "@/features/shared/presentation/FinanceErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceOverview } from "@/features/dashboard/application/use-finance-overview";
import DashboardMobileStory from "@/features/dashboard/presentation/mobile/DashboardMobileStory";

/**
 * Die Auswertungen — eine Fläche, sechs Ansichten, zum Wischen.
 *
 * **Warum sie eine eigene Seite ist.** Sie steckte bis hierher am unteren Ende
 * der Übersicht: sechs Diagramme mit Registerleiste und Wischgeste, erreichbar
 * erst nach drei Bildschirmlängen Vorspann aus Kontostand, Stadt-Verweis,
 * Coach-Verweis, Suchfeld, Filter und Kennzahlen. Das Beste der Fläche lag
 * unter dem Schlechtesten begraben.
 *
 * Oben steht jetzt die Frage „wohin ist mein Geld gegangen" in drei Aussagen
 * (`/dashboard`), und wer es genauer wissen will, landet hier — auf einer
 * Fläche, die nichts anderes tut. Jede Ansicht ist über `?view=` adressierbar,
 * die Zurücktaste führt zurück zur Übersicht.
 *
 * **Die Reihenfolge der Zustände ist die Aussage.** Fehler geht vor
 * Leerzustand: Nach einem Lesefehler „du hast noch nichts" zu sagen, fordert
 * zum Neuerfassen von Daten auf, die längst da sind.
 */
export default function AuswertungenPage() {
  const model = useFinanceOverview();

  if (model.hasError) return <FinanceErrorState onRetry={model.actions.reload} />;
  if (model.loading) return <Skeleton variant="shimmer" className="h-64 w-full rounded-lg" />;
  if (model.isEmpty) return <FinanceEmptyState />;

  return <DashboardMobileStory model={model} />;
}
