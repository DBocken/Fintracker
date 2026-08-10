import { useState, useMemo } from 'react';
import { TrendingUp, DollarSign, Settings } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DecimalInput } from '@/features/shared/presentation/DecimalInput';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { niceTicksForData, valueAxisProps } from '@/lib/chart-axis';
import { chartTooltipProps } from '@/lib/chart-tooltip';
import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { useI18n } from '@/i18n/useI18n';
import type { Transaction } from '../types';
import { CHART_EXPENSE, CHART_INCOME, CHART_NET } from '@/lib/chart-colors';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import { computeTotalFlow, computeAutoStartingBalance, buildBalanceHistory } from '@/features/dashboard/domain/overview-calculations';
import { useChartAnimation } from '@/hooks/useChartAnimation';
import { useSeriesSummary } from '@/hooks/useSeriesSummary';
import { ChartFigure } from '@/features/shared/presentation/ChartFigure';
import { LoadingSwap } from '@/features/shared/presentation/LoadingSwap';
import { Skeleton } from '@/components/ui/skeleton';

interface AdvancedBalanceChartProps {
  className?: string;
  endBalanceFromAccounts: number;
  transactions: Transaction[];
  isLoading?: boolean;
}

export function AdvancedBalanceChart({ endBalanceFromAccounts, transactions, isLoading = false }: AdvancedBalanceChartProps) {
  const { t } = useI18n();
  const money = useMoneyFormat();
  const chartAnimation = useChartAnimation();
  const seriesSummary = useSeriesSummary();
  // null = automatisch (aus Endsaldo/Kontenstand zurückgerechnet)
  const [startingBalance, setStartingBalance] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [tempBalance, setTempBalance] = useState<number | null>(0);
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
  // WP-6.8: Die Rechnung dafür steht jetzt in `niceTicksForData` und gilt für
  // alle Charts — vorher stand sie nur hier.
  const yTicks = useMemo(
    () =>
      niceTicksForData(chartData, ['income', 'expenses', 'cumulative'], {
        includeZero: axisFromZero,
      }),
    [chartData, axisFromZero],
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleApplyStartingBalance = () => {
    setStartingBalance(tempBalance ?? 0);
    setShowSettings(false);
  };

  const handleUseAuto = () => {
    setStartingBalance(null);
    setTempBalance(autoStartingBalance);
  };

  // WP-7.3: Der Wechsel Ladezustand -> Inhalt laeuft ueber LoadingSwap statt
  // ueber einen fruehen `return`. Damit gelten hier dieselben Regeln wie
  // ueberall: kein Skeleton unter der Wahrnehmungsschwelle, und ein einmal
  // gezeigtes bleibt lange genug, um gelesen zu werden.
  return (
    <LoadingSwap
      loading={isLoading}
      skeleton={
        <Card className="card-premium">
          <CardContent className="space-y-3 py-8">
            <Skeleton variant="shimmer" className="h-6 w-48" />
            <Skeleton variant="shimmer" className="h-72 w-full md:h-96" />
            <span className="sr-only">{t('balanceChart.loading')}</span>
          </CardContent>
        </Card>
      }
    >
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
                setTempBalance(effectiveStartingBalance);
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
              {money.mask(formatCurrency(endBalanceFromAccounts))}
            </span>
            {' • '}{t('balanceChart.startingBalanceLabel')}{' '}
            <span className="font-semibold text-foreground">
              {money.mask(formatCurrency(effectiveStartingBalance))}
            </span>
            {chartData.length > 0 && (
              <>
                {' • '}{t('balanceChart.currentBalance')}{' '}
                <span className="font-semibold text-foreground">
                  {money.mask(formatCurrency(chartData[chartData.length - 1]?.cumulative ?? 0))}
                </span>
              </>
            )}
          </div>

          {/* WP-6.10: Das SVG ist für Hilfstechnik ausgeblendet; Aussage und
              Werte stehen als Satz und als Tabelle daneben. */}
          <ChartFigure
            caption={t('balanceChart.title')}
            summary={seriesSummary({
              title: t('balanceChart.title'),
              values: chartData.map((point) => point.cumulative),
              formatValue: (value) => (money.mask(formatCurrency(value))),
              labelAt: (index) => chartData[index]?.label ?? '',
            })}
            columns={[
              { key: 'label', label: t('balanceChart.dateColumn'), format: (row) => row.label },
              {
                key: 'income',
                label: t('balanceChart.income'),
                numeric: true,
                format: (row) => (money.mask(formatCurrency(row.income))),
              },
              {
                key: 'expenses',
                label: t('balanceChart.expenses'),
                numeric: true,
                format: (row) => (money.mask(formatCurrency(row.expenses))),
              },
              {
                key: 'cumulative',
                label: t('balanceChart.balance'),
                numeric: true,
                format: (row) => (money.mask(formatCurrency(row.cumulative))),
              },
            ]}
            rows={chartData}
            rowKey={(row, index) => `${row.label}-${index}`}
          >
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
                {...valueAxisProps({
                  ticks: yTicks,
                  width: 64,
                  tickFormatter: (value) => money.mask(`${value.toFixed(0)} €`),
                })}
              />
              <Tooltip
                {...chartTooltipProps({
                  formatValue: (value) => money.mask(`${value.toFixed(2)}€`),
                  formatLabel: (label) => t('balanceChart.dateLabel').replace('{label}', label),
                  seriesLabels: {
                    income: t('balanceChart.income'),
                    expenses: t('balanceChart.expenses'),
                    balance: t('balanceChart.balance'),
                  },
                })}
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
          </ChartFigure>

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
        <DialogContent className="card-premium" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('balanceChart.dialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="startingBalance">{t('balanceChart.startingBalanceInput')}</Label>
              <DecimalInput
                id="startingBalance"
                value={tempBalance}
                onChange={setTempBalance}
                placeholder={t('balanceChart.placeholder')}
              />
            </div>

            <div className="space-y-2">
              <Button
                onClick={handleUseAuto}
                variant="outline"
                className="w-full btn-secondary-premium"
              >
                {t('balanceChart.calculateFromBalance').replace('{amount}', money.mask(formatCurrency(autoStartingBalance)))}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              <p>• <strong>{t('balanceChart.calculateFromBalance')}:</strong> {t('balanceChart.calculateHint')}</p>
              <p>• <strong>{t('balanceChart.manualLabel')}</strong> {t('balanceChart.manualEntry')}</p>
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
    </LoadingSwap>
  );
}