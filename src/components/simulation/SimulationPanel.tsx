"use client";

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { getTransactions, getCategories } from '@/services/transaction-service';
import { SimulationEngine } from './SimulationEngine';
import { BudgetOptimizer } from './BudgetOptimizer';
import type { Transaction, Category } from '@/types';

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export function SimulationPanel() {
  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: () => getTransactions(10000),
  });
  const { data: categories = [], isLoading: catLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const [riskK, setRiskK] = useState(1);
  const [overrides, setOverrides] = useState<Record<string, { min: number; max: number }>>({});

  const engine = useMemo(() => new SimulationEngine(transactions, categories), [transactions, categories]);

  const projection = useMemo(() => {
    if (transactions.length === 0) return null;
    return engine.build12MonthProjectionEnhanced([], [], {
      riskK,
      scenario: 'realistic',
      categoryOverrides: overrides,
    });
  }, [engine, transactions.length, riskK, overrides]);

  const chartData = useMemo(() => {
    if (!projection) return [];
    return projection.points.map((p) => ({
      month: p.label,
      optimistisch: Math.round(p.cumNetMax),
      realistisch: Math.round(p.cumNetRealistic),
      pessimistisch: Math.round(p.cumNetMin),
    }));
  }, [projection]);

  const months = useMemo(() => projection?.points.map((p) => p.label) ?? [], [projection]);

  if (txLoading || catLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="p-8 text-center">
          <div className="text-4xl">📊</div>
          <h3 className="mt-3 text-lg font-semibold">Noch keine Daten für die Simulation</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Importiere zuerst Transaktionen, damit die Simulation deinen Cashflow projizieren kann.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            Kumulierter Saldo – 12 Monate
          </CardTitle>
          <CardDescription>
            Projektion auf Basis deiner echten Einnahmen, Verträge und variablen Ausgaben.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Unsicherheit (Risikofaktor)</Label>
              <span className="text-sm text-muted-foreground">{riskK.toFixed(1)}×</span>
            </div>
            <Slider value={[riskK]} min={0.5} max={2} step={0.1} onValueChange={(v) => setRiskK(v[0])} />
            <p className="text-xs text-muted-foreground">
              Höher = breiterer Korridor zwischen optimistischem und pessimistischem Szenario.
            </p>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => eur.format(v)} width={70} />
                <Tooltip
                  formatter={(value: number) => eur.format(value)}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12 }}
                />
                <Legend />
                <Line type="monotone" dataKey="optimistisch" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="realistisch" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="pessimistisch" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {projection && projection.insights.length > 0 && (
            <ul className="space-y-1.5">
              {projection.insights.map((insight, i) => (
                <li key={i} className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                  {insight}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <BudgetOptimizer
        engine={engine}
        categories={categories}
        months={months}
        riskK={riskK}
        onApplyOverrides={setOverrides}
      />
    </div>
  );
}