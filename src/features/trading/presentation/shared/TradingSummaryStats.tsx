/**
 * Kennzahlenreihe der Trading-Fläche (Gesamtwert, Investiert, Gewinn/Verlust,
 * Rendite).
 *
 * Aus `TradingDashboard.tsx` herausgelöst (WP 6.3). Reine Anzeige aus einem
 * bereits berechneten `PortfolioSummary` — hier wird nichts aggregiert, damit
 * Desktop und Mobil dieselben Zahlen zeigen können, ohne sie zweimal zu rechnen.
 *
 * **Warum kein `<Card>`-Raster mehr.** Die vier Werte standen bis WP 6.3 in vier
 * `<Card>`-Kacheln, ohne dass eine davon etwas tut — genau der tote Karten-Rahmen,
 * den AGENTS.md §9 („Karten sind Aktionen") ausschliesst. Sichtbar wurde das erst
 * durch die Aufspaltung: Solange die Kacheln in derselben Datei wie die
 * Aktionsleiste standen, sah `pnpm check:card-rule` dort `onClick=` und hielt die
 * Fläche für interaktiv. Ersatz ist der karten-lose Readout-Baustein
 * `InfoStatStrip` — derselbe, den die eToro-Tabs dieser Fläche längst benutzen
 * (`EtoroOverviewTab`, `EtoroDemoAccountCard`), die Fläche wird dadurch in sich
 * einheitlich. Die Richtung von Gewinn/Verlust trägt weiterhin Farbe (`tone`) und
 * Vorzeichen; die vier dekorativen Icons entfallen mit dem Rahmen.
 */
import type { PortfolioSummary } from '@/types';
import { useI18n } from '@/i18n/useI18n';
import { InfoStatStrip, type InfoStat } from '@/components/common/InfoGroup';
import { formatCurrency } from '@/lib/utils';

export interface TradingSummaryStatsProps {
  summary: PortfolioSummary;
  /** eToro-Depots blenden einen Hinweis zur Herkunft des Gesamtwerts ein. */
  isEtoro: boolean;
}

/** Vorzeichenbehaftete Prozentangabe — „+3,20 %" statt „3.20%". */
function signedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export default function TradingSummaryStats({ summary, isEtoro }: TradingSummaryStatsProps) {
  const { t } = useI18n();
  const tone = (value: number): InfoStat['tone'] => (value >= 0 ? 'positive' : 'warning');

  const items: InfoStat[] = [
    {
      label: t('trading.dashboard.summary.totalValue'),
      value: formatCurrency(summary.total_value, summary.currency),
      hint: isEtoro
        ? t('trading.etoro.overview.totalValueHint')
        : t('trading.dashboard.summary.positionsCount').replace('{count}', String(summary.positions_count)),
    },
    {
      label: t('trading.dashboard.summary.invested'),
      value: formatCurrency(summary.total_cost, summary.currency),
    },
    {
      label: t('trading.dashboard.summary.gainLoss'),
      value: `${summary.unrealized_gain_loss >= 0 ? '+' : ''}${formatCurrency(summary.unrealized_gain_loss, summary.currency)}`,
      hint: signedPercent(summary.unrealized_gain_loss_percent),
      tone: tone(summary.unrealized_gain_loss),
    },
    {
      label: t('trading.dashboard.summary.return'),
      value: signedPercent(summary.unrealized_gain_loss_percent),
      hint: t('trading.dashboard.summary.unrealizedReturn'),
      tone: tone(summary.unrealized_gain_loss_percent),
    },
  ];

  return <InfoStatStrip items={items} />;
}
