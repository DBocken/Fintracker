import { TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useI18n } from '@/i18n/useI18n';
import { useChartAnimation } from '@/hooks/useChartAnimation';
import { formatCurrency } from '@/lib/utils';
import EmptyState from '@/components/common/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PerformancePoint } from '@/services/etoro-performance';
import { selectPerformanceTrend } from '@/services/etoro-performance';
import EtoroScopeGate from './EtoroScopeGate';
import { chartNumber } from '@/lib/chart-tooltip';

interface EtoroPerformanceTabProps {
  isLocked: boolean;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  series: PerformancePoint[];
}

// eToro-Konten laufen in USD — nie das EUR-Default.
const USD = 'USD';

const trendColor: Record<string, string> = {
  positive: 'hsl(var(--positive))',
  warning: 'hsl(var(--warning))',
  neutral: 'hsl(var(--primary))',
};

function formatAxisDate(date: string, locale: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-US', { day: '2-digit', month: '2-digit' });
}

/**
 * Echter Performance-Chart für eToro-Portfolios (/balances/history) — ersetzt
 * den bisherigen synthetischen Mock (Issue: Performance-Tab zeigte nie echte
 * Daten). Linienfarbe datengetrieben nach Trend (positive/warning/neutral,
 * siehe selectPerformanceTrend); Aufbau-Animation nutzt die zentralen
 * Motion-Tokens (WP-6.7).
 */
export default function EtoroPerformanceTab({ isLocked, isLoading, error, onRetry, series }: EtoroPerformanceTabProps) {
  const { t, locale } = useI18n();
  const chartAnimation = useChartAnimation();
  const trend = selectPerformanceTrend(series);

  const chartData = series.map((point) => ({
    ...point,
    label: formatAxisDate(point.date, locale),
  }));

  return (
    <EtoroScopeGate isLocked={isLocked} isLoading={isLoading} error={error} onRetry={onRetry}>
      {series.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title={t('trading.etoro.performance.emptyTitle')}
          description={t('trading.etoro.performance.emptyDesc')}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('trading.etoro.performance.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value) => [formatCurrency(chartNumber(value), USD), t('trading.etoro.performance.valueLabel')]} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={trendColor[trend]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={chartAnimation.animate}
                  animationDuration={chartAnimation.animationDuration}
                  animationEasing={chartAnimation.animationEasing}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-4 text-center text-xs text-muted-foreground">{t('trading.etoro.performance.disclaimer')}</p>
          </CardContent>
        </Card>
      )}
    </EtoroScopeGate>
  );
}
