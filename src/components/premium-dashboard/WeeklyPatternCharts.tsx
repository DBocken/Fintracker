import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface WeeklyPatternChartsProps {
  weeklyData: Array<{
    day: string;
    income: number;
    expenses: number;
  }>;
}

export function WeeklyPatternCharts({ weeklyData }: WeeklyPatternChartsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Wöchentliche Einnahmen</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis tickFormatter={(value) => `${value.toFixed(0)}€`} />
              <Tooltip 
                formatter={(value: number) => [value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }), '']}
                labelFormatter={(label) => `Wochentag: ${label}`}
              />
              <Legend formatter={() => 'Einnahmen'} />
              <Bar dataKey="income" fill="#10b981" name="Einnahmen" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wöchentliche Ausgaben</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis tickFormatter={(value) => `${value.toFixed(0)}€`} />
              <Tooltip 
                formatter={(value: number) => [value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }), '']}
                labelFormatter={(label) => `Wochentag: ${label}`}
              />
              <Legend formatter={() => 'Ausgaben'} />
              <Bar dataKey="expenses" fill="#ef4444" name="Ausgaben" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}