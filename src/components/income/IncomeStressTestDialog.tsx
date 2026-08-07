import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InfoStatStrip, type InfoStat } from '@/components/common/InfoGroup';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { useForecast } from '@/hooks/useForecast';
import { useForecastOverrides } from '@/hooks/useForecastOverrides';
import { runScenarioComparison } from '@/lib/forecast-scenario';
import { buildStreamLossScenario } from '@/lib/income-stress';
import type { IncomeStream } from '@/lib/income-streams';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';

const formatCurrency = (v: number) =>
  v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const formatDelta = (v: number) =>
  `${v > 0 ? '+' : ''}${v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}`;

export default function IncomeStressTestDialog({
  stream,
  open,
  onOpenChange,
}: {
  stream: IncomeStream | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const money = useMoneyFormat();
  const { t } = useI18n();
  const { overrides } = useForecastOverrides();
  const { input, isLoading } = useForecast({
    months: overrides.months,
    safetyBuffer: overrides.safetyBuffer,
    bufferBasis: overrides.bufferBasis,
  });

  const comparison = useMemo(() => {
    if (!input || !stream) return null;
    const scenario = buildStreamLossScenario(stream, input.recurringFlows ?? []);
    if (!scenario) return 'unmatched' as const;
    return runScenarioComparison(
      input,
      {
        months: overrides.months,
        safetyBuffer: overrides.safetyBuffer,
        bufferBasis: overrides.bufferBasis,
        useDailyProfile: true,
      },
      scenario,
    );
  }, [input, stream, overrides.months, overrides.safetyBuffer, overrides.bufferBasis]);

  const shiftIsAmbiguous =
    comparison !== null && comparison !== 'unmatched' && comparison.firstBreachShiftDays === null;

  const stats: InfoStat[] | null =
    comparison && comparison !== 'unmatched'
      ? [
          {
            label: t('income.stress.lowestBalance'),
            value: money.mask(formatCurrency(comparison.lowestBalance.scenario)),
            hint: formatDelta(comparison.lowestBalance.delta),
            tone: comparison.lowestBalance.delta < 0 ? 'critical' : 'default',
          },
          {
            label: t('income.stress.daysBelowBuffer'),
            value: String(comparison.daysBelowSafetyBuffer.scenario),
            hint: `${comparison.daysBelowSafetyBuffer.delta > 0 ? '+' : ''}${comparison.daysBelowSafetyBuffer.delta}`,
            tone: comparison.daysBelowSafetyBuffer.delta > 0 ? 'critical' : 'default',
          },
          {
            label: t('income.stress.firstBreachShift'),
            value:
              comparison.firstBreachShiftDays === null
                ? '—'
                : t('income.stress.shiftDays').replace('{days}', String(comparison.firstBreachShiftDays)),
          },
        ]
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {stream ? t('income.stress.dialogTitle').replace('{name}', stream.label) : ''}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="py-4 text-sm text-muted-foreground">{t('income.stress.loading')}</p>
        ) : comparison === 'unmatched' ? (
          <p className="py-4 text-sm text-muted-foreground">{t('income.stress.notInForecast')}</p>
        ) : stats ? (
          <div className="space-y-4">
            <InfoStatStrip items={stats} />
            {shiftIsAmbiguous ? (
              <p className="text-xs text-muted-foreground">{t('income.stress.shiftNone')}</p>
            ) : null}
            <Button asChild variant="outline" className="w-full">
              <Link to="/liquidity">{t('income.stress.deepDiveCta')}</Link>
            </Button>
          </div>
        ) : (
          <p className="py-4 text-sm text-muted-foreground">{t('income.stress.loading')}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
