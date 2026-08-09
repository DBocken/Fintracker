/**
 * Tab „Performance".
 *
 * Aus `TradingDashboard.tsx` herausgelöst (WP 6.3). Die Weiche bleibt exakt die
 * alte: eToro-Depots zeigen den echten Kontostand-Verlauf (`/balances/history`),
 * alle anderen den ausdrücklich als simuliert gekennzeichneten Vorschau-Verlauf.
 */
import { useMemo } from 'react';
import type { PortfolioSummary } from '@/types';
import { useI18n } from '@/i18n/useI18n';
import { useChartAnimation } from '@/hooks/useChartAnimation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartFigure } from '@/components/common/ChartFigure';
import { chartTooltipProps } from '@/lib/chart-tooltip';
import { formatCurrency } from '@/lib/utils';
import { buildPerformancePreview } from '@/features/trading/domain/performance-preview';
import type { PerformancePoint } from '@/services/etoro-performance';
import EtoroPerformanceTab from '../etoro/EtoroPerformanceTab';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface TradingPerformanceTabProps {
  isEtoro: boolean;
  summary: PortfolioSummary | undefined;
  /** Nur für eToro-Depots ausgewertet: der echte Kontostand-Verlauf. */
  etoro: {
    isLocked: boolean;
    isLoading: boolean;
    error: Error | null;
    onRetry: () => void;
    series: PerformancePoint[];
  };
}

export default function TradingPerformanceTab({ isEtoro, summary, etoro }: TradingPerformanceTabProps) {
  const { t } = useI18n();
  const chartAnimation = useChartAnimation();

  // Simulierter Verlauf fuer Depots ohne echte Kurshistorie. EINMAL berechnet
  // und deterministisch — die fruehere Fassung wuerfelte je Aufruf neu und
  // wurde zweimal pro Render gerufen, sodass Tabelle und Diagramm verschiedene
  // Zahlen zeigten (siehe features/trading/domain/performance-preview.ts).
  const performancePreview = useMemo(
    () =>
      buildPerformancePreview(
        summary ? { totalCost: summary.total_cost, totalValue: summary.total_value } : null,
      ),
    [summary],
  );

  const performancePreviewLabel = (day: number | null) =>
    day === null
      ? t('trading.dashboard.performanceChart.startLabel')
      : t('trading.dashboard.performanceChart.dayLabel').replace('{n}', String(day));

  // PERF-4: Bisher entstand dieses Array inline im JSX (LineChart-Prop) und
  // damit bei jedem Render neu, auch wenn sich weder performancePreview noch
  // die Uebersetzung geaendert hat. `t` ist in I18nProvider ein stabiles
  // useCallback (deps: [locale, wording]) — als Abhaengigkeit bildet es also
  // exakt die Faelle ab, in denen sich performancePreviewLabel(day) aendern
  // kann (Sprachwechsel, Wording-Wechsel), ohne bei jedem Render neu zu greifen.
  const performancePreviewChartData = useMemo(
    () => performancePreview.map((point) => ({ ...point, label: performancePreviewLabel(point.day) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- performancePreviewLabel ist reine Funktion von (day, t); t traegt den relevanten State.
    [performancePreview, t],
  );

  if (isEtoro) {
    // eToro-Portfolios zeigen den echten Kontostand-Verlauf
    // (/balances/history) — nie mehr den synthetischen Mock unten.
    return (
      <EtoroPerformanceTab
        isLocked={etoro.isLocked}
        isLoading={etoro.isLoading}
        error={etoro.error}
        onRetry={etoro.onRetry}
        series={etoro.series}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('trading.dashboard.performanceChart.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* WP-6.10: Werte auch ohne Diagramm zugaenglich. */}
        <ChartFigure
          caption={t('trading.dashboard.performanceChart.valueLabel')}
          columns={[
            { key: 'day', label: t('balanceChart.dateColumn'), format: (row) => performancePreviewLabel(row.day) },
            {
              key: 'value',
              label: t('trading.dashboard.performanceChart.valueLabel'),
              numeric: true,
              format: (row) => formatCurrency(row.value, 'EUR'),
            },
          ]}
          rows={performancePreview}
          rowKey={(row, index) => `${row.day ?? 'start'}-${index}`}
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performancePreviewChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip
                {...chartTooltipProps({
                  formatValue: (value) => formatCurrency(value, 'EUR'),
                  seriesLabels: { value: t('trading.dashboard.performanceChart.valueLabel') },
                })}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                isAnimationActive={chartAnimation.animate}
                animationDuration={chartAnimation.animationDuration}
                animationEasing={chartAnimation.animationEasing}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartFigure>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          {t('trading.dashboard.performanceChart.disclaimer')}
        </p>
      </CardContent>
    </Card>
  );
}
