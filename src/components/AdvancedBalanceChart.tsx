import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, DollarSign, Settings } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { yAxisDomain } from '@/lib/chart-axis';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import type { Transaction } from '../types';
import { getTransactions } from '../services/transaction-service';
import { CHART_EXPENSE, CHART_INCOME, CHART_NET } from '@/lib/chart-colors';

interface AdvancedBalanceChartProps {
  className?: string;
  endBalanceFromAccounts: number
}

export function AdvancedBalanceChart({ endBalanceFromAccounts }: AdvancedBalanceChartProps) {
  // null = automatisch (aus Endsaldo/Kontenstand zurückgerechnet)
  const [startingBalance, setStartingBalance] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [tempBalance, setTempBalance] = useState<string>('0');
  // Achsen-Hygiene (#54): Auto-Skalierung als Default, 0-Linie optional erzwingbar
  const [axisFromZero, setAxisFromZero] = useState(false);

  const { data: txs = [], isLoading } = useQuery<Transaction[], Error>({
    queryKey: ['transactions-chart'],
    queryFn: () => getTransactions(1000),
  });

  const totalFlow = useMemo(() => txs.reduce((sum, tx) => sum + tx.amount, 0), [txs]);

  // Wir nehmen den aktuellen Kontostand als Endwert und rechnen den Startwert zurück.
  const autoStartingBalance = useMemo(() => {
    const computed = endBalanceFromAccounts - totalFlow;
    return Number.isFinite(computed) ? computed : 0;
  }, [endBalanceFromAccounts, totalFlow]);

  const effectiveStartingBalance = startingBalance ?? autoStartingBalance;

  const chartData = useMemo(() => {
    if (!txs.length) return [];

    // Sort transactions by actual date ascending
    const sortedTxs = [...txs].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

    // Map keyed by ISO date for robust ordering
    const dailyMap = new Map<string, {
      iso: string;
      label: string;
      income: number;
      expenses: number;
      balance: number;
      cumulative: number;
    }>();

    let currentBalance = effectiveStartingBalance;

    sortedTxs.forEach(tx => {
      const isoKey = format(parseISO(tx.date), 'yyyy-MM-dd');
      const label = format(parseISO(tx.date), 'dd.MM', { locale: de });

      if (!dailyMap.has(isoKey)) {
        dailyMap.set(isoKey, {
          iso: isoKey,
          label,
          income: 0,
          expenses: 0,
          balance: 0,
          cumulative: currentBalance
        });
      }

      const day = dailyMap.get(isoKey)!;

      if (tx.amount > 0) {
        day.income += tx.amount;
      } else {
        day.expenses += Math.abs(tx.amount);
      }

      day.balance += tx.amount;
      currentBalance += tx.amount;
      day.cumulative = currentBalance;
    });

    // Return ascending by ISO date
    return Array.from(dailyMap.values()).sort((a, b) => a.iso.localeCompare(b.iso));
  }, [txs, effectiveStartingBalance]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleApplyStartingBalance = () => {
    const balance = parseFloat(tempBalance);
    setStartingBalance(Number.isFinite(balance) ? balance : 0);
    setShowSettings(false);
  };

  const handleUseAuto = () => {
    setStartingBalance(null);
    setTempBalance(autoStartingBalance.toFixed(2));
  };

  if (isLoading) {
    return (
      <Card className="card-premium">
        <CardContent className="py-8 text-center">
          <div className="animate-pulse">Lade Kontoverlauf...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="card-premium h-full">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Wie entwickelt sich mein Kontostand?
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={axisFromZero} onCheckedChange={(v) => setAxisFromZero(Boolean(v))} />
              <span className="text-sm text-muted-foreground">Ab 0</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTempBalance(effectiveStartingBalance.toFixed(2));
                setShowSettings(true);
              }}
              className="btn-secondary-premium"
            >
              <Settings className="h-4 w-4 mr-1" />
              Startwert
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 text-sm text-muted-foreground">
            Endsaldo (Kontostand):{' '}
            <span className="font-semibold text-foreground">{formatCurrency(endBalanceFromAccounts)}</span>
            {' • '}Startsaldo:{' '}
            <span className="font-semibold text-foreground">{formatCurrency(effectiveStartingBalance)}</span>
            {chartData.length > 0 && (
              <>
                {' • '}Aktueller Saldo:{' '}
                <span className="font-semibold text-foreground">
                  {formatCurrency(chartData[chartData.length - 1]?.cumulative ?? 0)}
                </span>
              </>
            )}
          </div>

          <div className="h-72 md:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              {/* Pastell-Gradients (Design-Direktive C): Linie + sanfter Verlauf darunter */}
              <defs>
                <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_INCOME} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={CHART_INCOME} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="fillExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_EXPENSE} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={CHART_EXPENSE} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="fillNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_NET} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={CHART_NET} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
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
                width={64}
                domain={yAxisDomain({ includeZero: axisFromZero })}
                tickFormatter={(value) => `${(value as number).toFixed(0)} €`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)'
                }}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(2)}€`,
                  name === 'income' ? 'Einnahmen' :
                  name === 'expenses' ? 'Ausgaben' : 'Saldo'
                ]}
                labelFormatter={(label) => `Datum: ${label}`}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value) =>
                  value === 'income' ? 'Einnahmen' :
                    value === 'expenses' ? 'Ausgaben' : 'Saldo'
                }
              />

              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />

              <Area
                type="monotone"
                dataKey="income"
                stroke={CHART_INCOME}
                strokeWidth={2}
                fill="url(#fillIncome)"
                dot={false}
                activeDot={{ r: 5, stroke: CHART_INCOME, strokeWidth: 2 }}
                name="income"
              />

              <Area
                type="monotone"
                dataKey="expenses"
                stroke={CHART_EXPENSE}
                strokeWidth={2}
                fill="url(#fillExpense)"
                dot={false}
                activeDot={{ r: 5, stroke: CHART_EXPENSE, strokeWidth: 2 }}
                name="expenses"
              />

              <Area
                type="monotone"
                dataKey="cumulative"
                stroke={CHART_NET}
                strokeWidth={2.5}
                fill="url(#fillNet)"
                dot={false}
                activeDot={{ r: 6, stroke: CHART_NET, strokeWidth: 2 }}
                name="balance"
              />
            </AreaChart>
          </ResponsiveContainer>
          </div>

          {chartData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Keine Transaktionen vorhanden</p>
              <p className="text-sm mt-2">Importiere deine Bank-CSV um den Kontoverlauf zu sehen</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="card-premium">
          <DialogHeader>
            <DialogTitle>Startsaldo einstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="startingBalance">Startsaldo (€)</Label>
              <Input
                id="startingBalance"
                type="number"
                step="0.01"
                value={tempBalance}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempBalance(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Button
                onClick={handleUseAuto}
                variant="outline"
                className="w-full btn-secondary-premium"
              >
                Aus Kontostand berechnen ({formatCurrency(autoStartingBalance)})
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              <p>• <strong>Aus Kontostand berechnen:</strong> Nutzt den aktuellen Kontostand als Endwert und rechnet den Startwert zurück</p>
              <p>• <strong>Manuell:</strong> Gib einen beliebigen Startwert ein</p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleApplyStartingBalance} className="flex-1 btn-premium">
                Anwenden
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowSettings(false)}
                className="flex-1"
              >
                Abbrechen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}