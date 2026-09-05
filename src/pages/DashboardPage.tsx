import { Suspense, lazy } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDisplayDensity } from "@/hooks/useDisplayDensity";

/**
 * Nur die gewählte Dichte wird geladen (ADR `darstellungsdichte.md` Regel 6).
 *
 * Vorher standen beide Fassungen im Baum und eine wurde per `lg:hidden` /
 * `hidden lg:block` weggeblendet — auf genau dem Gerät mit der wenigsten Luft
 * also doppeltes DOM, doppelte Recharts-Instanzen und beide Fassungen im
 * Bündel. Die Schwelle lag dabei bei 1024 px statt der verbindlichen 768:
 * Wer sein Fenster auf 900 px zog, bekam die MOBILE Fassung auf einem
 * Desktop-Bildschirm.
 */
const DashboardKompakt = lazy(() =>
  import("@/components/dashboard/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const DashboardFokussiertHost = lazy(
  () => import("@/features/dashboard/presentation/mobile/DashboardFokussiertHost"),
);

/**
 * Dünner Routen-Einstieg (§3): Er wählt die Dichte, sonst nichts.
 *
 * Der Seitenname steht bei beiden im Inhalt bzw. in der App-Leiste — die Shell
 * rendert ihn einmal zentral, diese Seite trägt ihn deshalb nicht.
 */
export default function DashboardPage() {
  const dichte = useDisplayDensity();

  return (
    <Suspense fallback={<Skeleton variant="shimmer" className="h-64 w-full rounded-lg" />}>
      {dichte === "fokussiert" ? <DashboardFokussiertHost /> : <DashboardKompakt />}
    </Suspense>
  );
}
