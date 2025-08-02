import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface MixedChartProps {
  data: Array<{
    month: string;
    income: number;
    expenses: number;
    forecast: number;
    scenario1: number;
  }>;
}

export const MixedChart: React.FC<MixedChartProps> = ({ data }) => {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="month" 
          tick={{ fontSize: 12 }}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <YAxis 
          tick={{ fontSize: 12 }}
          axisLine={{ stroke: '#e5e7eb' }}
          tickFormatter={(value) => `${value.toLocaleString('de-DE')} €`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar dataKey="income" fill="#44D7B6" name="Einnahmen" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" fill="#F17C7C" name="Ausgaben" radius={[4, 4, 0, 0]} />
        <Line 
          type="monotone" 
          dataKey="forecast" 
          stroke="#1e40af" 
          strokeWidth={3}
          name="Base Forecast"
          dot={{ fill: '#1e40af', strokeWidth: 2, r: 4 }}
        />
        <Line 
          type="monotone" 
          dataKey="scenario1" 
          stroke="#60a5fa" 
          strokeWidth={2}
          strokeDasharray="5 5"
          name="Szenario 1"
          dot={{ fill: '#60a5fa', strokeWidth: 2, r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};