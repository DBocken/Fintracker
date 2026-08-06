import { useState, useMemo } from 'react';
import { TrendingUp, DollarSign, Settings } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { niceTicks, yAxisDomain } from '@/lib/chart-axis';
import { chartNumber, chartText } from '@/lib/chart-tooltip';
import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { useI18n } from '@/i18n/useI18n';
import type { Transaction } from '../types';
import { CHART_EXPENSE, CHART_INCOME, CHART_NET } from '@/lib/chart-colors';
import { useGentleMode } from '@/components/providers/GentleModeProvider';
import { computeTotalFlow, computeAutoStartingBalance, buildBalanceHistory } from '@/features/dashboard/domain/overview-calculations';
import { useChartAnimation } from '@/hooks/useChartAnimation';

interface AdvancedBalanceChartProps {
  className?: string;
  endBalanceFromAccounts: number;
  transactions: Transaction[];
  isLoading?: boolean;
}

export function AdvancedBalanceChart({ endBalanceFromAccounts, transactions, isLoading = false }: AdvancedBalanceChartProps) {
  const { t } = useI18n();
  const { enabled: gentleModeEnabled } = useGentleMode();
  const chartAnimation = useChartAnimation();
  // null = automatisch (aus Endsaldo/Kontenstand zurückgerechnet)
  const [startingBalance, setStartingBalance] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [tempBalance, setTempBalance] = useState<string>('0');
  // Achsen-Hygiene (#54): Auto-Skalierung als Default, 0-Linie optional erzwingbar
  const [axisFromZero, setAxisFromZero] = useState(false);

  const totalFlow = useMemo(() => computeTotalFlow(transactions), [transactions]);

  // Wir nehmen den aktuellen Kontostand als Endwert und rechnen den Startwert zurück.
  const autoStartingBalance = useMemo(
    () => computeAutoStartingBalance(endBalanceFromAccounts, totalFlow),
    [endBalanceFromAccounts, totalFlow],
  );

  const effectiveStartingBalance = startingBalance ?? autoStartingBalance;

  const chartData = useMemo(
    () => buildBalanceHistory(transactions, effectiveStartingBalance),
    [transactions, effectiveStartingBalance],
  );

  // Runde Achsen-Ticks statt Recharts-Interpolation (Befund D-1, WP-4.6-Review):
  // über alle drei geplotteten Serien, damit keine aus der Achse fällt.
  const yTicks = useMemo(() => {
    if (chartData.length === 0) return null;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const point of chartData) {
      for (const value of [point.income, point.expenses, point.cumulative]) {
        if (value < min) min = value;
        if (value > max) max = value;
      }
    }
    return niceTicks(min, max, { includeZero: axisFromZero });
  }, [chartData, axisFromZero]);

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
          <div className="animate-pulse">{t('balanceChart.loading')}</div>
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
            {t('balanceChart.title')}
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={axisFromZero}
                onCheckedChange={(v) => setAxisFromZero(Boolean(v))}
                aria-label={t('balanceChart.zeroAxisLabel')}
              />
              <span className="text-sm text-muted-foreground">{t('balanceChart.zeroAxisLabel')}</span>
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
              {t('balanceChart.startingBalance')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 text-sm text-muted-foreground">
            {t('balanceChart.endBalance')}{' '}
            <span className="font-semibold text-foreground">
              {gentleModeEnabled ? '***' : formatCurrency(endBalanceFromAccounts)}
            </span>
            {' • '}{t('balanceChart.startingBalanceLabel')}{' '}
            <span className="font-semibold text-foreground">
              {gentleModeEnabled ? '***' : formatCurrency(effectiveStartingBalance)}
            </span>
            {chartData.length > 0 && (
              <>
                {' • '}{t('balanceChart.currentBalance')}{' '}
                <span className="font-semibold text-foreground">
                  {gentleModeEnabled ? '***' : formatCurrency(chartData[chartData.length - 1]?.cumulative ?? 0)}
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
                ticks={yTicks ?? undefined}
                domain={yTicks ? [yTicks[0], yTicks[yTicks.length - 1]] : yAxisDomain({ includeZero: axisFromZero })}
                tickFormatter={(value) => gentleModeEnabled ? '••' : `${(value as number).toFixed(0)} €`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)'
                }}
                formatter={(value, name) => [
                  gentleModeEnabled ? '***' : `${chartNumber(value).toFixed(2)}€`,
                  name === 'income' ? t('balanceChart.income') :
                  name === 'expenses' ? t('balanceChart.expenses') : t('balanceChart.balance')
                ]}
                labelFormatter={(label) => t('balanceChart.dateLabel').replace('{label}', chartText(label))}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value) =>
                  value === 'income' ? t('balanceChart.income') :
                    value === 'expenses' ? t('balanceChart.expenses') : t('balanceChart.balance')
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
                isAnimationActive={chartAnimation.animate}
                animationDuration={chartAnimation.animationDuration}
                animationEasing={chartAnimation.animationEasing}
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
                isAnimationActive={chartAnimation.animate}
                animationDuration={chartAnimation.animationDuration}
                animationEasing={chartAnimation.animationEasing}
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
                isAnimationActive={chartAnimation.animate}
                animationDuration={chartAnimation.animationDuration}
                animationEasing={chartAnimation.animationEasing}
              />
            </AreaChart>
          </ResponsiveContainer>
          </div>

          {chartData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('balanceChart.noTransactions')}</p>
              <p className="text-sm mt-2">{t('balanceChart.noTransactionsHint')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="card-premium">
          <DialogHeader>
            <DialogTitle>{t('balanceChart.dialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="startingBalance">{t('balanceChart.startingBalanceInput')}</Label>
              <Input
                id="startingBalance"
                type="number"
                step="0.01"
                value={tempBalance}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempBalance(e.target.value)}
                placeholder={t('balanceChart.placeholder')}
              />
            </div>

            <div className="space-y-2">
              <Button
                onClick={handleUseAuto}
                variant="outline"
                className="w-full btn-secondary-premium"
              >
                {t('balanceChart.calculateFromBalance').replace('{amount}', gentleModeEnabled ? '***' : formatCurrency(autoStartingBalance))}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              <p>• <strong>{t('balanceChart.calculateFromBalance')}:</strong> {t('balanceChart.calculateHint')}</p>
              <p>• <strong>Manuell:</strong> {t('balanceChart.manualEntry')}</p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleApplyStartingBalance} className="flex-1 btn-premium">
                {t('balanceChart.apply')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowSettings(false)}
                className="flex-1"
              >
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}