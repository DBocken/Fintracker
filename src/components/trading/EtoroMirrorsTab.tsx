import { useState } from 'react';
import { Users } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import { formatCurrency } from '@/lib/utils';
import EmptyState from '@/components/common/EmptyState';
import InteractiveCard from '@/components/common/InteractiveCard';
import { InfoStatStrip, type InfoStat } from '@/components/common/InfoGroup';
import type { EtoroAggregatePortfolioResponse } from '@/services/etoro-api-schemas';
import { selectEtoroMirrors, selectMirrorTotals } from '@/services/etoro-mirrors';
import EtoroScopeGate from './EtoroScopeGate';

interface EtoroInstrumentMetaLite {
  symbol: string;
  name?: string;
}

interface EtoroMirrorsTabProps {
  isLocked: boolean;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  aggregate: EtoroAggregatePortfolioResponse | undefined;
  /** instrumentId → Symbol/Name, für die aufgeklappte Instrumentenliste je Mirror. Optional (nice-to-have). */
  instrumentMeta?: Map<number, EtoroInstrumentMetaLite>;
}

// eToro-Konten laufen in USD — nie das EUR-Default.
const USD = 'USD';
const fmt = (v: number) => formatCurrency(v, USD);
const signTone = (v: number): InfoStat['tone'] => (v >= 0 ? 'positive' : 'warning');

/**
 * Smart-Portfolios-Tab: zeigt eToros Copy-Trading-Beziehungen (mirrors) als
 * Akkordion-Karten (Wert/G-V eingeklappt sichtbar, enthaltene Instrumente
 * aufklappbar) plus einer Summenzeile über alle Mirrors.
 */
export default function EtoroMirrorsTab({
  isLocked,
  isLoading,
  error,
  onRetry,
  aggregate,
  instrumentMeta,
}: EtoroMirrorsTabProps) {
  const { t } = useI18n();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const mirrors = selectEtoroMirrors(aggregate);
  const totals = selectMirrorTotals(mirrors);

  const toggle = (mirrorId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(mirrorId)) {
        next.delete(mirrorId);
      } else {
        next.add(mirrorId);
      }
      return next;
    });
  };

  const headerStats: InfoStat[] = [
    { label: t('trading.etoro.mirrors.headerValue'), value: fmt(totals.totalValue) },
    { label: t('trading.etoro.mirrors.headerNetFunding'), value: fmt(totals.totalNetFunding) },
    {
      label: t('trading.etoro.mirrors.headerPnl'),
      value: fmt(totals.totalPnl),
      tone: signTone(totals.totalPnl),
    },
  ];

  return (
    <EtoroScopeGate isLocked={isLocked} isLoading={isLoading} error={error} onRetry={onRetry}>
      <div className="space-y-6">
        <h2 className="text-sm font-medium text-muted-foreground">{t('trading.etoro.mirrors.title')}</h2>

        {mirrors.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t('trading.etoro.mirrors.emptyTitle')}
            description={t('trading.etoro.mirrors.emptyDesc')}
          />
        ) : (
          <>
            <InfoStatStrip items={headerStats} />

            <div className="space-y-3">
              {mirrors.map((mirror) => {
                const isExpanded = expandedIds.has(mirror.mirrorId);
                const panelId = `etoro-mirror-panel-${mirror.mirrorId}`;

                return (
                  <div key={mirror.mirrorId}>
                    <InteractiveCard
                      onClick={() => toggle(mirror.mirrorId)}
                      expanded={isExpanded}
                      aria-controls={panelId}
                      aria-label={t('trading.etoro.mirrors.portfolioLabel').replace('{id}', String(mirror.mirrorId))}
                    >
                      <div className="flex flex-1 flex-wrap items-center justify-between gap-x-6 gap-y-2">
                        <div className="min-w-0">
                          <div className="font-medium">
                            {t('trading.etoro.mirrors.portfolioLabel').replace('{id}', String(mirror.mirrorId))}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t('trading.etoro.mirrors.invested')}: {fmt(mirror.investedNet)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold tabular-nums">
                            {t('trading.etoro.mirrors.value')}: {fmt(mirror.value)}
                          </div>
                          <div className={`text-xs tabular-nums ${mirror.pnl >= 0 ? 'text-positive' : 'text-warning'}`}>
                            {mirror.pnl >= 0 ? '+' : ''}
                            {fmt(mirror.pnl)} ({mirror.pnlPercent >= 0 ? '+' : ''}
                            {mirror.pnlPercent.toFixed(2)}%)
                          </div>
                        </div>
                      </div>
                    </InteractiveCard>

                    {isExpanded && (
                      <div id={panelId} className="mt-2 rounded-lg bg-muted/30 p-4">
                        <div className="mb-2 text-xs font-medium text-muted-foreground">
                          {t('trading.etoro.mirrors.instruments')}
                        </div>
                        {mirror.instrumentIds.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t('trading.etoro.mirrors.emptyDesc')}</p>
                        ) : (
                          <ul className="space-y-1 text-sm">
                            {mirror.instrumentIds.map((instrumentId) => {
                              const meta = instrumentMeta?.get(instrumentId);
                              return (
                                <li key={instrumentId}>
                                  {meta?.name ||
                                    meta?.symbol ||
                                    t('trading.etoro.mirrors.instrumentFallback').replace('{id}', String(instrumentId))}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </EtoroScopeGate>
  );
}
