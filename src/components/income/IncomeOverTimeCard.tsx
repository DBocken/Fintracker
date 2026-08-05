import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { chartRamp } from '@/lib/chart-colors';
import { useChartAnimation } from '@/hooks/useChartAnimation';
import { useI18n } from '@/i18n/useI18n';
import type { IncomeOverTimePoint } from '@/lib/analysis-data';
import { chartNumber } from '@/lib/chart-tooltip';

const formatCurrencyInt = (v: number) =>
  v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/** Gestapeltes Balkendiagramm: Einnahmen je Monat, je Hauptkategorie eine Farbe. */
export default function IncomeOverTimeCard({ points }: { points: IncomeOverTimePoint[] }) {
  const { t } = useI18n();
  // Baseline: Balken bauen sich auf; bei prefers-reduced-motion direkt Zielzustand.
  const chartAnimation = useChartAnimation();

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

  return (
    <Card className="card-premium h-full">
      <CardHeader>
        <CardTitle>{t('income.overTimeTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
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
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(v: number) => `${Math.round(v)} €`}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                  }}
                  formatter={(v) => formatCurrencyInt(Math.round(chartNumber(v)))}
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
      </CardContent>
    </Card>
  );
}
