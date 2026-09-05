import FinanceEmptyState from "@/features/shared/presentation/FinanceEmptyState";
import FinanceErrorState from "@/features/shared/presentation/FinanceErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceOverview } from "../../application/use-finance-overview";
import DashboardFokussiert from "./DashboardFokussiert";

/**
 * Der Wirt der fokussierten Übersicht: er holt das ViewModel und entscheidet
 * über die drei Zustände. Die Darstellung darunter bekommt nur Daten.
 *
 * **Warum der Hook hier steht und nicht in der Seite.** Der Aufruf darf nur
 * stattfinden, wenn diese Fassung auch wirklich gerendert wird — sonst liefe
 * er in der kompakten Dichte ein zweites Mal, weil `Dashboard` ihn dort selbst
 * ruft. Ein Hook lässt sich nicht bedingt aufrufen; ein Wirt, der bedingt
 * gerendert wird, schon. Das ist derselbe Grund, aus dem ADR Regel 6 nur EINE
 * Präsentation mounten lässt.
 *
 * **Die Reihenfolge der Zustände ist die Aussage.** Fehler geht vor
 * Leerzustand: Nach einem Lesefehler „du hast noch nichts" zu sagen, fordert
 * zum Neuerfassen von Daten auf, die längst da sind.
 */
export default function DashboardFokussiertHost() {
  const model = useFinanceOverview();

  if (model.hasError) return <FinanceErrorState onRetry={model.actions.reload} />;
  if (model.loading) return <Skeleton variant="shimmer" className="h-64 w-full rounded-lg" />;
  if (model.isEmpty) return <FinanceEmptyState />;

  return <DashboardFokussiert model={model} />;
}
