import { Wallet } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import { formatCurrency } from '@/lib/utils';
import StatHero from '@/components/common/StatHero';
import { InfoGroup, InfoStatStrip, type InfoStat } from '@/components/common/InfoGroup';
import type { EtoroAggregatePortfolioResponse } from '@/services/etoro-api-schemas';
import EtoroScopeGate from './EtoroScopeGate';

interface EtoroOverviewTabProps {
  isLocked: boolean;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  aggregate: EtoroAggregatePortfolioResponse | undefined;
  /** Σ aktueller Wert der lokal gespeicherten eToro-Positionen (USD). */
  localPositionsValue: number;
}

// eToro-Konten laufen in USD (siehe etoro-service.ts) — nie das EUR-Default.
const USD = 'USD';
const fmt = (v: number | undefined) => formatCurrency(v ?? 0, USD);
const signTone = (v: number | undefined): InfoStat['tone'] =>
  (v ?? 0) >= 0 ? 'positive' : 'warning';

/**
 * Übersicht-Tab für eToro-Portfolios: zeigt die eToro-Kontowahrheit
 * (Gesamtwert inkl. Cash & Smart Portfolios) — Werte, die die lokalen
 * Positions-Summary-Karten nicht kennen. Plus ein Abgleich lokaler
 * Positionswerte gegen den eToro-Kontostand.
 */
export default function EtoroOverviewTab({
  isLocked,
  isLoading,
  error,
  onRetry,
  aggregate,
  localPositionsValue,
}: EtoroOverviewTabProps) {
  const { t } = useI18n();
  const totals = aggregate?.accountTotals;
  const cashTotal = (totals?.accountAvailableCash ?? 0) + (totals?.accountFrozenCash ?? 0);

  const accountStats: InfoStat[] = [
    { label: t('trading.etoro.overview.availableCash'), value: fmt(totals?.accountAvailableCash) },
    { label: t('trading.etoro.overview.frozenCash'), value: fmt(totals?.accountFrozenCash) },
    { label: t('trading.etoro.overview.balance'), value: fmt(totals?.accountBalance) },
    {
      label: t('trading.etoro.overview.openPnl'),
      value: fmt(totals?.accountCurrentPnl),
      tone: signTone(totals?.accountCurrentPnl),
    },
    { label: t('trading.etoro.overview.usedMargin'), value: fmt(totals?.accountTotalUsedMargin) },
  ];

  const reconcileStats: InfoStat[] = [
    { label: t('trading.etoro.overview.localPositions'), value: fmt(localPositionsValue) },
    { label: t('trading.etoro.overview.etoroCash'), value: fmt(cashTotal) },
    { label: t('trading.etoro.overview.etoroTotal'), value: fmt(totals?.accountTotalValue) },
  ];

  return (
    <EtoroScopeGate isLocked={isLocked} isLoading={isLoading} error={error} onRetry={onRetry}>
      <div className="space-y-6">
        <StatHero
          label={t('trading.etoro.overview.accountTotalValue')}
          icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
          value={fmt(totals?.accountTotalValue)}
          caption={t('trading.etoro.overview.accountTotalCaption')}
        />

        <InfoGroup title={t('trading.etoro.overview.accountSection')}>
          <InfoStatStrip items={accountStats} />
        </InfoGroup>

        <InfoGroup
          title={t('trading.etoro.overview.reconcileSection')}
          description={t('trading.etoro.overview.reconcileHint')}
        >
          <InfoStatStrip items={reconcileStats} />
        </InfoGroup>
      </div>
    </EtoroScopeGate>
  );
}
