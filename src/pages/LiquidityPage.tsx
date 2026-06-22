import PageHeader from '@/components/common/PageHeader';
import LiquidityReport from '@/components/dashboard/LiquidityReport';
import { useI18n } from '@/i18n/useI18n';

/**
 * Liquiditäts-Forecast: tagesgenaue Projektion des verfügbaren Geldes mit
 * Sicherheitspuffer, Monatstief und Risiko-Kennzahlen.
 */
export default function LiquidityPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <PageHeader
        title={t("other.liquidityTitle")}
        description={t("other.liquidityDesc")}
      />
      <LiquidityReport />
    </div>
  );
}
