import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { useI18n } from '@/i18n/useI18n';
import { chartNumber } from '@/lib/chart-tooltip';
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
              <YAxis tickFormatter={(value) => `${value.toFixed(0)}€`} />
              <Tooltip
                formatter={(value) => [chartNumber(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }), '']}
                labelFormatter={(label) => t("premium.weekly.weekdayLabel").replace('{label}', String(label))}
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
              <YAxis tickFormatter={(value) => `${value.toFixed(0)}€`} />
              <Tooltip
                formatter={(value) => [chartNumber(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }), '']}
                labelFormatter={(label) => t("premium.weekly.weekdayLabel").replace('{label}', String(label))}
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