import PageHeader from '@/features/shared/presentation/PageHeader';
import LiquidityReport from '@/components/dashboard/LiquidityReport';
import WaterfallPanel from '@/components/budgets/WaterfallPanel';
import { LoadingSwap } from '@/features/shared/presentation/LoadingSwap';
import { Skeleton } from '@/components/ui/skeleton';
import { useWaterfallPlan } from '@/hooks/useWaterfallPlan';
import { useI18n } from '@/i18n/useI18n';

/**
 * Liquiditäts-Forecast: tagesgenaue Projektion des verfügbaren Geldes mit
 * Sicherheitspuffer, Monatstief und Risiko-Kennzahlen.
 */
export default function LiquidityPage() {
  const { t } = useI18n();
  // WP-10.4: Der Wasserfall steht ÜBER dem Bericht, und seine Höhe hängt an
  // seinen Daten. Erschien er nachträglich, schob er den ganzen Bericht nach
  // unten (CLS 0,102 gegen ein Budget von 0,1). Ein höhengleiches Skelett gibt
  // es nicht, weil die Höhe eben nicht vorher feststeht — also wartet die
  // Seite und zeigt beides zusammen. Der Bericht selbst darf danach wachsen:
  // Er ist das letzte Element, unter ihm steht nichts mehr, das verrutschen
  // könnte.
  const { isLoading } = useWaterfallPlan();

  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      <PageHeader
        title={t("other.liquidityTitle")}
        description={t("other.liquidityDesc")}
      />
      <LoadingSwap
        loading={isLoading}
        skeleton={
          <div className="space-y-6">
            <Skeleton variant="shimmer" className="h-64 w-full rounded-2xl" />
            <Skeleton variant="shimmer" className="h-96 w-full rounded-2xl" />
          </div>
        }
      >
        <div className="space-y-6">
          <WaterfallPanel />
          <LiquidityReport />
        </div>
      </LoadingSwap>
    </div>
  );
}
