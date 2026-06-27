import PageHeader from '@/components/common/PageHeader';
import LiquidityReport from '@/components/dashboard/LiquidityReport';
import WaterfallPanel from '@/components/budgets/WaterfallPanel';
import { useI18n } from '@/i18n/useI18n';

/**
 * Liquiditäts-Forecast: tagesgenaue Projektion des verfügbaren Geldes mit
 * Sicherheitspuffer, Monatstief und Risiko-Kennzahlen.
 */
export default function LiquidityPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      <PageHeader
        title={t("other.liquidityTitle")}
        description={t("other.liquidityDesc")}
      />
      <div className="space-y-6">
        <WaterfallPanel />
        <LiquidityReport />
      </div>
    </div>
  );
}
