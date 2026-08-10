import { useEffect, useState } from 'react';
import { PieChart } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import { formatCurrency } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import EmptyState from '@/features/shared/presentation/EmptyState';
import { InfoGroup, InfoStatStrip, type InfoStat } from '@/features/shared/presentation/InfoGroup';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { EtoroAggregatePortfolioResponse } from '@/services/etoro-api-schemas';
import { selectSectorExposure, selectFeesPnlBreakdown, selectFeesPnlTotals } from '@/services/etoro-analysis';
import EtoroScopeGate from './EtoroScopeGate';

interface EtoroInstrumentMetaLite {
  symbol: string;
  name?: string;
}

interface EtoroAnalysisTabProps {
  isLocked: boolean;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  aggregate: EtoroAggregatePortfolioResponse | undefined;
  /** instrumentId → stocksIndustryId, aus fetchEtoroInstrumentMeta. */
  instrumentIndustryMap: Map<number, number | undefined>;
  /** stocksIndustryId → Branchenname, aus fetchEtoroStocksIndustries. */
  industryNameMap: Map<number, string>;
  /** instrumentId → Symbol/Name für die Breakdown-Zeilen. Optional (nice-to-have). */
  instrumentMeta?: Map<number, EtoroInstrumentMetaLite>;
}

// eToro-Konten laufen in USD — nie das EUR-Default.
const USD = 'USD';
const fmt = (v: number) => formatCurrency(v, USD);
const signTone = (v: number): InfoStat['tone'] => (v >= 0 ? 'positive' : 'warning');

/**
 * Sektor-Balken baut sich beim Mount von 0 auf den Ziel-Prozentwert auf
 * (Animations-Baseline: Daten poppen nicht auf) — außer bei
 * prefers-reduced-motion, dort direkt der Zielzustand.
 */
function SectorBar({ percent }: { percent: number }) {
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(reduce ? percent : 0);

  useEffect(() => {
    if (reduce) {
      setWidth(percent);
      return;
    }
    const frame = requestAnimationFrame(() => setWidth(percent));
    return () => cancelAnimationFrame(frame);
  }, [percent, reduce]);

  return <Progress value={width} className="h-2" />;
}

/**
 * Analyse-Tab für eToro-Portfolios: Sektor-Exposure (Konzentration je
 * Branche) und ein Gebühren-/P&L-Breakdown je Instrument. Beides sind reine
 * Selektoren auf der bereits geladenen aggregate-portfolio-Query (Übersicht/
 * Smart Portfolios) — kein eigener Konto-Fetch, daher ein einzelnes
 * EtoroScopeGate analog zu den beiden anderen Tabs, die dieselbe Query nutzen.
 */
export default function EtoroAnalysisTab({
  isLocked,
  isLoading,
  error,
  onRetry,
  aggregate,
  instrumentIndustryMap,
  industryNameMap,
  instrumentMeta,
}: EtoroAnalysisTabProps) {
  const { t } = useI18n();

  const sectors = selectSectorExposure(aggregate, instrumentIndustryMap, industryNameMap);
  const breakdown = selectFeesPnlBreakdown(aggregate);
  const totals = selectFeesPnlTotals(breakdown);

  const totalsStats: InfoStat[] = [
    { label: t('trading.etoro.analysis.totalFees'), value: fmt(totals.totalFees) },
    { label: t('trading.etoro.analysis.totalTaxes'), value: fmt(totals.totalTaxes) },
    { label: t('trading.etoro.analysis.totalPnl'), value: fmt(totals.totalPnl), tone: signTone(totals.totalPnl) },
  ];

  return (
    <EtoroScopeGate isLocked={isLocked} isLoading={isLoading} error={error} onRetry={onRetry}>
      <div className="space-y-6">
        <h2 className="text-sm font-medium text-muted-foreground">{t('trading.etoro.analysis.title')}</h2>

        <InfoGroup title={t('trading.etoro.analysis.sectorSection')}>
          {sectors.length === 0 ? (
            <EmptyState
              icon={PieChart}
              title={t('trading.etoro.analysis.sectorEmptyTitle')}
              description={t('trading.etoro.analysis.sectorEmptyDesc')}
            />
          ) : (
            <div className="space-y-3">
              {sectors.map((sector) => {
                const label =
                  sector.industryName ||
                  (sector.industryId != null
                    ? t('trading.etoro.analysis.industryFallback').replace('{id}', String(sector.industryId))
                    : t('trading.etoro.analysis.industryUnknown'));

                return (
                  <div key={sector.industryId ?? 'unknown'} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {fmt(sector.exposure)} ({sector.percent.toFixed(1)}%)
                      </span>
                    </div>
                    <SectorBar percent={sector.percent} />
                  </div>
                );
              })}
            </div>
          )}
        </InfoGroup>

        <InfoGroup title={t('trading.etoro.analysis.breakdownSection')}>
          {breakdown.length === 0 ? (
            <EmptyState
              icon={PieChart}
              title={t('trading.etoro.analysis.breakdownEmptyTitle')}
              description={t('trading.etoro.analysis.breakdownEmptyDesc')}
            />
          ) : (
            <div className="space-y-4">
              <InfoStatStrip items={totalsStats} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('trading.etoro.analysis.columnInstrument')}</TableHead>
                    <TableHead className="text-right">{t('trading.etoro.analysis.columnFees')}</TableHead>
                    <TableHead className="text-right">{t('trading.etoro.analysis.columnTaxes')}</TableHead>
                    <TableHead className="text-right">{t('trading.etoro.analysis.columnPnl')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdown.map((entry) => {
                    const meta = instrumentMeta?.get(entry.instrumentId);
                    const label =
                      meta?.name ||
                      meta?.symbol ||
                      t('trading.etoro.analysis.instrumentFallback').replace('{id}', String(entry.instrumentId));

                    return (
                      <TableRow key={entry.instrumentId}>
                        <TableCell className="font-medium">{label}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(entry.fees)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(entry.taxes)}</TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-medium ${
                            entry.pnl >= 0 ? 'text-positive' : 'text-warning'
                          }`}
                        >
                          {entry.pnl >= 0 ? '+' : ''}
                          {fmt(entry.pnl)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </InfoGroup>
      </div>
    </EtoroScopeGate>
  );
}
