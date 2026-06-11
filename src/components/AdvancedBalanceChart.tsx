import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, DollarSign, Settings } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import type { Transaction } from '../types';
import { getTransactions } from '../services/transaction-service';

interface AdvancedBalanceChartProps {
  className?: string;
  endBalanceFromAccounts: number
}

export function AdvancedBalanceChart({ endBalanceFromAccounts }: AdvancedBalanceChartProps) {
  // null = automatisch (aus Endsaldo/Kontenstand zurückgerechnet)
  const [startingBalance, setStartingBalance] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [tempBalance, setTempBalance] = useState<string>('0');

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
      <Card className="card-premium">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Kontoverlauf & Cashflow
          </CardTitle>
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

          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(value) => `${(value as number).toFixed(0)}€`}
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

              <Line
                type="monotone"
                dataKey="income"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#22c55e', strokeWidth: 2 }}
                name="income"
              />

              <Line
                type="monotone"
                dataKey="expenses"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2 }}
                name="expenses"
              />

              <Line
                type="monotone"
                dataKey="cumulative"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7, stroke: '#3b82f6', strokeWidth: 2 }}
                name="balance"
              />
            </LineChart>
          </ResponsiveContainer>

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