import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import InteractiveCard from '@/components/common/InteractiveCard';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { buildTransactionsHref } from '@/components/dashboard/filter-utils';
import type { IncomeStream } from '@/lib/income-streams';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';

const formatCurrency = (v: number) =>
  v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const VISIBLE_INITIAL = 8;

function trendIcon(trend: IncomeStream['trend']) {
  if (trend === 'up') return <TrendingUp className="h-3.5 w-3.5 text-positive" aria-hidden="true" />;
  if (trend === 'down') return <TrendingDown className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />;
}

/** Liste der erkannten Einkommensströme — jede Karte navigiert zu den gefilterten Buchungen. */
export default function IncomeStreamList({ streams }: { streams: IncomeStream[] }) {
  const money = useMoneyFormat();
  const { t } = useI18n();
  const [showAll, setShowAll] = useState(false);

  if (streams.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t('income.noIncome')}</p>;
  }

  const visible = showAll ? streams : streams.slice(0, VISIBLE_INITIAL);
  const cadenceLabel = (stream: IncomeStream) =>
    stream.cadence === 'regelmaessig' ? t('income.cadenceRegular') : t('income.cadenceIrregular');

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {visible.map((stream) => (
          <li key={stream.key}>
            <InteractiveCard
              to={buildTransactionsHref({ category: stream.mainCategoryId ?? 'all', search: stream.label })}
              aria-label={`${stream.label}: ${t('spendingBreakdown.viewTransactions')}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{stream.label}</span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {money.mask(formatCurrency(stream.monthlyAverage))}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">{t('income.monthlyAvg')}</span>
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{stream.mainCategoryName}</span>
                <span>•</span>
                <span>{cadenceLabel(stream)}</span>
                <span className="inline-flex items-center gap-1">
                  {trendIcon(stream.trend)}
                </span>
                <span>•</span>
                <span>{t('income.lastReceived')}: {stream.lastDateISO}</span>
              </div>
            </InteractiveCard>
          </li>
        ))}
      </ul>
      {streams.length > VISIBLE_INITIAL && !showAll && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(true)}>
          {t('income.showAll')}
        </Button>
      )}
    </div>
  );
}
