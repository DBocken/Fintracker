import PageHeader from '@/components/common/PageHeader';
import LiquidityReport from '@/components/dashboard/LiquidityReport';

/**
 * Liquiditäts-Forecast: tagesgenaue Projektion des verfügbaren Geldes mit
 * Sicherheitspuffer, Monatstief und Risiko-Kennzahlen.
 */
export default function LiquidityPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <PageHeader
        title="Liquidität"
        description="Wann wird dein Geld knapp – und warum? Tagesgenaue Vorschau aus deinen Konten, Verträgen und Ausgaben."
      />
      <LiquidityReport />
    </div>
  );
}
