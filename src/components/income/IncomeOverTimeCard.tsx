import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { chartRamp } from '@/lib/chart-colors';
import { useChartAnimation } from '@/hooks/useChartAnimation';
import { useI18n } from '@/i18n/useI18n';
import type { IncomeOverTimePoint } from '@/lib/analysis-data';
import { chartTooltipProps } from '@/lib/chart-tooltip';
import { niceTicksForStackedData, valueAxisProps } from '@/lib/chart-axis';
import { useSeriesSummary } from '@/hooks/useSeriesSummary';
import { ChartFigure } from '@/features/shared/presentation/ChartFigure';

const formatCurrencyInt = (v: number) =>
  v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/** Gestapeltes Balkendiagramm: Einnahmen je Monat, je Hauptkategorie eine Farbe. */
export default function IncomeOverTimeCard({ points }: { points: IncomeOverTimePoint[] }) {
  const { t } = useI18n();
  // Baseline: Balken bauen sich auf; bei prefers-reduced-motion direkt Zielzustand.
  const chartAnimation = useChartAnimation();
  const seriesSummary = useSeriesSummary();

  // Hauptkategorien, die irgendwo im Zeitraum vorkommen — nach Gesamtbetrag
  // absteigend, damit die größten Ströme zuunterst (am stabilsten) liegen.
  const mainIds = useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of points) {
      for (const [id, value] of Object.entries(p.byMain)) {
        totals.set(id, (totals.get(id) ?? 0) + value);
      }
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [points]);

  const colors = useMemo(() => chartRamp(mainIds.length), [mainIds]);

  const series = useMemo(
    () => points.map((p) => ({ month: p.month, ...p.byMain })),
    [points],
  );

  // WP-6.8: Runde Achsenwerte. Gestapelt gerechnet — die Achse muss die Summe
  // aller Kategorien eines Monats abdecken, nicht die größte Einzelkategorie.
  const yTicks = useMemo(() => niceTicksForStackedData(series, mainIds), [series, mainIds]);

  return (
    <Card className="card-premium h-full">
      <CardHeader>
        <CardTitle>{t('income.overTimeTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* WP-6.10: Monatssummen als Satz und Tabelle neben dem Diagramm. */}
        <ChartFigure
          caption={t('income.overTimeTitle')}
          summary={seriesSummary({
            title: t('income.overTimeTitle'),
            values: points.map((p) => Object.values(p.byMain).reduce((sum, v) => sum + v, 0)),
            formatValue: (value) => formatCurrencyInt(Math.round(value)),
            labelAt: (index) => points[index]?.month ?? '',
          })}
          columns={[
            { key: 'month', label: t('income.monthColumn'), format: (row) => row.month },
            {
              key: 'total',
              label: t('income.totalColumn'),
              numeric: true,
              format: (row) =>
                formatCurrencyInt(
                  Math.round(Object.values(row.byMain).reduce((sum, v) => sum + v, 0)),
                ),
            },
          ]}
          rows={points}
          rowKey={(row) => row.month}
        >
        <div className="h-44 md:h-64">
          {points.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t('income.noIncome')}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  {...valueAxisProps({
                    ticks: yTicks,
                    width: 56,
                    tickFormatter: (v) => `${Math.round(v)} €`,
                  })}
                />
                <Tooltip
                  {...chartTooltipProps({
                    formatValue: (v) => formatCurrencyInt(Math.round(v)),
                  })}
                />
                {mainIds.map((id, idx) => (
                  <Bar
                    key={id}
                    dataKey={id}
                    stackId="income"
                    fill={colors[idx]}
                    radius={idx === mainIds.length - 1 ? [4, 4, 0, 0] : undefined}
                    maxBarSize={48}
                    isAnimationActive={chartAnimation.animate}
                    animationDuration={chartAnimation.animationDuration}
                    animationEasing={chartAnimation.animationEasing}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        </ChartFigure>
      </CardContent>
    </Card>
  );
}
