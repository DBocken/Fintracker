import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { useI18n } from '@/i18n/useI18n';
import { chartTooltipProps } from '@/lib/chart-tooltip';
import { niceTicksForData, valueAxisProps } from '@/lib/chart-axis';
import { useChartAnimation } from '@/hooks/useChartAnimation';

interface WeeklyPatternChartsProps {
  weeklyData: Array<{
    day: string;
    income: number;
    expenses: number;
  }>;
}

export function WeeklyPatternCharts({ weeklyData }: WeeklyPatternChartsProps) {
  const { t } = useI18n();
  const chartAnimation = useChartAnimation();
  // WP-6.8: Runde Achsenwerte. Bewusst je Chart eigene Ticks — beide Karten
  // stehen nebeneinander, aber Einnahmen und Ausgaben haben unterschiedliche
  // Größenordnungen; eine gemeinsame Achse würde die kleinere Serie plattdrücken.
  const incomeTicks = useMemo(() => niceTicksForData(weeklyData, ['income']), [weeklyData]);
  const expensesTicks = useMemo(() => niceTicksForData(weeklyData, ['expenses']), [weeklyData]);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("premium.weekly.incomeTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis
                {...valueAxisProps({
                  ticks: incomeTicks,
                  tickFormatter: (value) => `${value.toFixed(0)}€`,
                })}
              />
              <Tooltip
                {...chartTooltipProps({
                  formatValue: (value) =>
                    value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }),
                  formatLabel: (label) => t("premium.weekly.weekdayLabel").replace('{label}', label),
                  seriesLabels: { income: t("premium.weekly.incomeLabel") },
                })}
              />
              <Legend formatter={() => t("premium.weekly.incomeLabel")} />
              <Bar
                dataKey="income"
                fill="hsl(var(--positive))"
                name={t("premium.weekly.incomeLabel")}
                isAnimationActive={chartAnimation.animate}
                animationDuration={chartAnimation.animationDuration}
                animationEasing={chartAnimation.animationEasing}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("premium.weekly.expensesTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis
                {...valueAxisProps({
                  ticks: expensesTicks,
                  tickFormatter: (value) => `${value.toFixed(0)}€`,
                })}
              />
              <Tooltip
                {...chartTooltipProps({
                  formatValue: (value) =>
                    value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }),
                  formatLabel: (label) => t("premium.weekly.weekdayLabel").replace('{label}', label),
                  seriesLabels: { expenses: t("premium.weekly.expensesLabel") },
                })}
              />
              <Legend formatter={() => t("premium.weekly.expensesLabel")} />
              <Bar
                dataKey="expenses"
                fill="hsl(var(--brand))"
                name={t("premium.weekly.expensesLabel")}
                isAnimationActive={chartAnimation.animate}
                animationDuration={chartAnimation.animationDuration}
                animationEasing={chartAnimation.animationEasing}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}