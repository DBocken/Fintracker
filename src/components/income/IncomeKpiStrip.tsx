import { InfoStatStrip, type InfoStat } from '@/components/common/InfoGroup';
import { useI18n } from '@/i18n/useI18n';
import type { IncomeStreamsResult } from '@/lib/income-streams';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';

const formatCurrency = (v: number) =>
  v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/**
 * Kennzahlen-Zeile über den Einnahmen-Charts (reines Readout, kein Karten-
 * Chrome — die Werte haben keine eigene Folgeaktion, siehe InfoStatStrip).
 */
export default function IncomeKpiStrip({ streams }: { streams: IncomeStreamsResult }) {
  const money = useMoneyFormat();
  const { t } = useI18n();

  const diversificationLabel =
    streams.diversification === 'concentrated'
      ? t('income.diversificationConcentrated')
      : streams.diversification === 'moderate'
        ? t('income.diversificationModerate')
        : t('income.diversificationDiversified');

  const items: InfoStat[] = [
    { label: t('income.kpiTotal'), value: money.mask(formatCurrency(streams.totalIncome)) },
    { label: t('income.kpiStreams'), value: String(streams.streams.length) },
    {
      label: t('income.kpiLargestShare'),
      value: `${Math.round(streams.largestShare * 100)}%`,
      hint: diversificationLabel,
      tone: streams.diversification === 'concentrated' ? 'warning' : 'default',
    },
  ];

  return <InfoStatStrip items={items} />;
}
