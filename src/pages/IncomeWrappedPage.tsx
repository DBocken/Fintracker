import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FeatureGate } from '@/components/FeatureGate';
import EmptyState from '@/components/common/EmptyState';
import FinanceErrorState from '@/components/common/FinanceErrorState';
import { Button } from '@/components/ui/button';
import { getTransactions, getCategories } from '@/services/transaction-service';
import { pickWrappedYear, buildWrappedStats } from '@/lib/income-wrapped';
import { useI18n } from '@/i18n/useI18n';
import type { Transaction, Category } from '@/types';
import WrappedSlides from '@/components/income/wrapped/WrappedSlides';

/**
 * „Income Wrapped" — Fullscreen-Jahresrückblick (eigene Route ohne AppShell).
 * Premium-gated; Direktaufruf ohne Freischaltung zeigt den Upsell.
 */
export default function IncomeWrappedPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  // WP-9.6: `stats === null` heisst „zu wenig Daten fuer den Rueckblick".
  // Bei einem Lesefehler waere das eine Aussage ueber Daten, die gar nicht
  // gelesen werden konnten.
  const {
    data: txs = [],
    isError: txError,
    refetch: refetchTx,
  } = useQuery<Transaction[], Error>({
    queryKey: ['transactions', 5000],
    queryFn: () => getTransactions(5000),
  });
  const {
    data: cats = [],
    isError: catsError,
    refetch: refetchCats,
  } = useQuery<Category[], Error>({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  });

  const stats = useMemo(() => {
    const year = pickWrappedYear(txs, cats);
    return year === null ? null : buildWrappedStats(txs, cats, year);
  }, [txs, cats]);

  return (
    <FeatureGate feature="creatorPack">
      {txError || catsError ? (
        <div className="mx-auto max-w-md p-8">
          <FinanceErrorState
            variant="transactions"
            onRetry={() => {
              void refetchTx();
              void refetchCats();
            }}
          />
        </div>
      ) : stats === null ? (
        <div className="mx-auto max-w-md p-8">
          <EmptyState
            emoji="💶"
            title={t('income.wrapped.noDataTitle')}
            description={t('income.wrapped.noDataDesc')}
            action={<Button onClick={() => navigate('/income')}>{t('income.wrapped.close')}</Button>}
          />
        </div>
      ) : (
        <WrappedSlides stats={stats} onClose={() => navigate('/income')} />
      )}
    </FeatureGate>
  );
}
