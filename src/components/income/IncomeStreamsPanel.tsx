import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { subMonths } from 'date-fns';
import { Share2, Sparkles } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import SegmentedControl from '@/components/common/SegmentedControl';
import FinanceEmptyState from '@/components/common/FinanceEmptyState';
import EmptyState from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { getTransactions, getCategories } from '@/services/transaction-service';
import { buildIncomeBreakdown, buildIncomeOverTime } from '@/lib/analysis-data';
import { deriveIncomeStreams } from '@/lib/income-streams';
import { pickWrappedYear } from '@/lib/income-wrapped';
import { useTier } from '@/hooks/useTier';
import { hasFeatureAccess } from '@/lib/tier';
import { PremiumUpsell } from '@/components/PremiumUpsell';
import type { Transaction, Category } from '@/types';
import IncomeKpiStrip from './IncomeKpiStrip';
import IncomeBreakdownCard from './IncomeBreakdownCard';
import IncomeOverTimeCard from './IncomeOverTimeCard';
import IncomeStreamList from './IncomeStreamList';
import IncomePayoutRadar from './IncomePayoutRadar';
import ShareCardDialog from './ShareCardDialog';
import IncomeStressTestSection from './IncomeStressTestSection';
import IncomeTaxReserveHint from './IncomeTaxReserveHint';

type PeriodMode = '12m' | 'all';
const WINDOW_MONTHS = 12;

export default function IncomeStreamsPanel() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const tier = useTier();
  const creatorUnlocked = hasFeatureAccess(tier, 'creatorPack');
  const [period, setPeriod] = useState<PeriodMode>('12m');
  const [shareOpen, setShareOpen] = useState(false);

  const { data: txs = [], isLoading: txsLoading } = useQuery<Transaction[], Error>({
    queryKey: ['transactions', 5000],
    queryFn: () => getTransactions(5000),
  });

  const { data: cats = [] } = useQuery<Category[], Error>({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  });

  const periodTxs = useMemo(() => {
    if (period === 'all') return txs;
    const cutoff = subMonths(new Date(), WINDOW_MONTHS);
    return txs.filter((t) => new Date(t.date) >= cutoff);
  }, [txs, period]);

  const breakdown = useMemo(() => buildIncomeBreakdown(periodTxs, cats), [periodTxs, cats]);
  const overTime = useMemo(() => buildIncomeOverTime(periodTxs, cats), [periodTxs, cats]);
  // Ströme brauchen Historie für die Kadenz-Erkennung — immer auf dem 12-Monats-
  // Fenster berechnen, unabhängig von der gewählten Ansicht für Breakdown/Verlauf.
  const streams = useMemo(() => deriveIncomeStreams(txs, cats, { windowMonths: WINDOW_MONTHS }), [txs, cats]);
  const wrappedYear = useMemo(() => pickWrappedYear(txs, cats), [txs, cats]);

  if (!txsLoading && txs.length === 0) {
    return <FinanceEmptyState />;
  }

  return (
    <div className="space-y-6">
      <div className="max-w-xs">
        <SegmentedControl
          options={[
            { value: '12m', label: t('income.period12Months') },
            { value: 'all', label: t('income.periodAll') },
          ]}
          value={period}
          onValueChange={setPeriod}
          aria-label={t('income.periodSelectorLabel')}
        />
      </div>

      {breakdown.total === 0 ? (
        <EmptyState emoji="💶" title={t('income.emptyTitle')} description={t('income.emptyDesc')} />
      ) : (
        <>
          <IncomeKpiStrip streams={streams} />
          {creatorUnlocked && <IncomePayoutRadar streams={streams.streams} />}
          <div className="grid gap-6 lg:grid-cols-2">
            <IncomeBreakdownCard breakdown={breakdown} />
            <IncomeOverTimeCard points={overTime} />
          </div>
          {creatorUnlocked && <IncomeTaxReserveHint streams={streams.streams} />}
          {!creatorUnlocked && <PremiumUpsell feature="creatorPack" />}
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">{t('income.streamsTitle')}</h2>
              {creatorUnlocked && (
                <div className="flex gap-2">
                  {wrappedYear !== null && (
                    <Button variant="outline" size="sm" onClick={() => navigate('/income/wrapped')}>
                      <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t('income.wrapped.entryButton')}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
                    <Share2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t('income.share.buttonLabel')}
                  </Button>
                </div>
              )}
            </div>
            <IncomeStreamList streams={streams.streams} />
          </div>
          {creatorUnlocked && <IncomeStressTestSection streams={streams.streams} />}
          {creatorUnlocked && (
            <ShareCardDialog result={streams} open={shareOpen} onOpenChange={setShareOpen} />
          )}
        </>
      )}
    </div>
  );
}
