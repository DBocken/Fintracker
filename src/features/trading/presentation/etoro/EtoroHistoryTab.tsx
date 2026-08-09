import { History, ArrowLeftRight } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import { formatCurrency } from '@/lib/utils';
import EmptyState from '@/features/shared/presentation/EmptyState';
import { InfoGroup, InfoStatStrip, type InfoStat } from '@/features/shared/presentation/InfoGroup';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type {
  EtoroTradeHistoryResponse,
  EtoroPnlResponse,
  EtoroCashAccountTransactionsResponse,
} from '@/services/etoro-api-schemas';
import {
  selectClosedTrades,
  selectClosedTradesTotals,
  selectAccountPnl,
  selectCashMovements,
  selectCashMovementsTotals,
} from '@/services/etoro-history';
import EtoroScopeGate from './EtoroScopeGate';

interface EtoroInstrumentMetaLite {
  symbol: string;
  name?: string;
}

interface EtoroHistorySectionState<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

interface EtoroHistoryTabProps {
  isLocked: boolean;
  pnl: EtoroHistorySectionState<EtoroPnlResponse>;
  tradeHistory: EtoroHistorySectionState<EtoroTradeHistoryResponse>;
  cashMovements: EtoroHistorySectionState<EtoroCashAccountTransactionsResponse>;
  /** instrumentId → Symbol/Name für die Trade-Zeilen. Optional (nice-to-have). */
  instrumentMeta?: Map<number, EtoroInstrumentMetaLite>;
}

// eToro-Konten laufen in USD — nie das EUR-Default.
const USD = 'USD';
const fmt = (v: number | undefined) => formatCurrency(v ?? 0, USD);
const signTone = (v: number | undefined): InfoStat['tone'] => (v ?? 0) >= 0 ? 'positive' : 'warning';

function formatDate(timestamp: string | undefined, locale: string): string {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-US');
}

/**
 * Historie-Tab für eToro-Portfolios: Konto-P&L (Guthaben, unrealisierte G/V,
 * realisierte Smart-Portfolio-G/V) plus die Liste geschlossener Trades.
 *
 * Drei unabhängige Live-Abfragen (pnl/trade-history/cash-transactions,
 * unterschiedliche Rate-Limit-Gruppen) — daher drei separate
 * EtoroScopeGate-Instanzen, damit ein Fehler/Ladezustand einer Sektion die
 * anderen nicht blockiert.
 */
export default function EtoroHistoryTab({
  isLocked,
  pnl,
  tradeHistory,
  cashMovements,
  instrumentMeta,
}: EtoroHistoryTabProps) {
  const { t, locale } = useI18n();

  if (isLocked) {
    return (
      <EtoroScopeGate isLocked isLoading={false} error={null}>
        <></>
      </EtoroScopeGate>
    );
  }

  const accountPnl = selectAccountPnl(pnl.data);
  const trades = selectClosedTrades(tradeHistory.data);
  const tradesTotals = selectClosedTradesTotals(trades);
  const movements = selectCashMovements(cashMovements.data);
  const movementsTotals = selectCashMovementsTotals(movements);

  const pnlStats: InfoStat[] = [
    { label: t('trading.etoro.history.credit'), value: fmt(accountPnl.credit) },
    { label: t('trading.etoro.history.bonusCredit'), value: fmt(accountPnl.bonusCredit) },
    {
      label: t('trading.etoro.history.unrealizedPnl'),
      value: fmt(accountPnl.unrealizedPnl),
      tone: signTone(accountPnl.unrealizedPnl),
    },
    {
      label: t('trading.etoro.history.mirrorsRealizedPnl'),
      value: fmt(accountPnl.mirrorsRealizedPnl),
      tone: signTone(accountPnl.mirrorsRealizedPnl),
    },
  ];

  const tradesStats: InfoStat[] = [
    { label: t('trading.etoro.history.tradesCount'), value: String(tradesTotals.count) },
    {
      label: t('trading.etoro.history.tradesNetProfit'),
      value: fmt(tradesTotals.totalNetProfit),
      tone: signTone(tradesTotals.totalNetProfit),
    },
    { label: t('trading.etoro.history.tradesFees'), value: fmt(tradesTotals.totalFees) },
  ];

  const movementsStats: InfoStat[] = [
    { label: t('trading.etoro.history.cashMovementsCount'), value: String(movementsTotals.count) },
    {
      label: t('trading.etoro.history.cashMovementsNet'),
      value: fmt(movementsTotals.totalSigned),
      tone: signTone(movementsTotals.totalSigned),
    },
    { label: t('trading.etoro.history.cashMovementsFees'), value: fmt(movementsTotals.totalFees) },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-medium text-muted-foreground">{t('trading.etoro.history.title')}</h2>

      <EtoroScopeGate isLocked={false} isLoading={pnl.isLoading} error={pnl.error} onRetry={pnl.onRetry}>
        <InfoGroup title={t('trading.etoro.history.pnlSection')}>
          <InfoStatStrip items={pnlStats} />
        </InfoGroup>
      </EtoroScopeGate>

      <EtoroScopeGate
        isLocked={false}
        isLoading={tradeHistory.isLoading}
        error={tradeHistory.error}
        onRetry={tradeHistory.onRetry}
      >
        <InfoGroup title={t('trading.etoro.history.tradesSection')}>
          {trades.length === 0 ? (
            <EmptyState
              icon={History}
              title={t('trading.etoro.history.emptyTitle')}
              description={t('trading.etoro.history.emptyDesc')}
            />
          ) : (
            <div className="space-y-4">
              <InfoStatStrip items={tradesStats} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('trading.etoro.history.columnInstrument')}</TableHead>
                    <TableHead>{t('trading.etoro.history.columnDirection')}</TableHead>
                    <TableHead>{t('trading.etoro.history.columnOpened')}</TableHead>
                    <TableHead>{t('trading.etoro.history.columnClosed')}</TableHead>
                    <TableHead className="text-right">{t('trading.etoro.history.columnLeverage')}</TableHead>
                    <TableHead className="text-right">{t('trading.etoro.history.columnInvestment')}</TableHead>
                    <TableHead className="text-right">{t('trading.etoro.history.columnNetProfit')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.map((trade) => {
                    const meta = instrumentMeta?.get(trade.instrumentId);
                    const label =
                      meta?.name ||
                      meta?.symbol ||
                      t('trading.etoro.history.instrumentFallback').replace('{id}', String(trade.instrumentId));

                    return (
                      <TableRow key={trade.positionId}>
                        <TableCell className="font-medium">{label}</TableCell>
                        <TableCell>
                          <Badge variant={trade.isBuy === false ? 'destructive' : 'outline'}>
                            {trade.isBuy === false
                              ? t('trading.etoro.history.directionSell')
                              : t('trading.etoro.history.directionBuy')}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(trade.openTimestamp, locale)}</TableCell>
                        <TableCell>{formatDate(trade.closeTimestamp, locale)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {trade.leverage != null ? `${trade.leverage}x` : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(trade.investment)}</TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-medium ${
                            trade.netProfit >= 0 ? 'text-positive' : 'text-warning'
                          }`}
                        >
                          {trade.netProfit >= 0 ? '+' : ''}
                          {fmt(trade.netProfit)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </InfoGroup>
      </EtoroScopeGate>

      <EtoroScopeGate
        isLocked={false}
        isLoading={cashMovements.isLoading}
        error={cashMovements.error}
        onRetry={cashMovements.onRetry}
      >
        <InfoGroup title={t('trading.etoro.history.cashMovementsSection')}>
          {movements.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title={t('trading.etoro.history.cashMovementsEmptyTitle')}
              description={t('trading.etoro.history.cashMovementsEmptyDesc')}
            />
          ) : (
            <div className="space-y-4">
              <InfoStatStrip items={movementsStats} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('trading.etoro.history.columnDate')}</TableHead>
                    <TableHead>{t('trading.etoro.history.columnType')}</TableHead>
                    <TableHead>{t('trading.etoro.history.columnCounterparty')}</TableHead>
                    <TableHead className="text-right">{t('trading.etoro.history.columnAmount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>{formatDate(movement.postedAt, locale)}</TableCell>
                      <TableCell className="font-medium">{movement.subtype}</TableCell>
                      <TableCell>{movement.counterpartyName || '—'}</TableCell>
                      <TableCell
                        className={`text-right tabular-nums font-medium ${
                          movement.signedAmount >= 0 ? 'text-positive' : 'text-warning'
                        }`}
                      >
                        {movement.signedAmount >= 0 ? '+' : ''}
                        {formatCurrency(movement.signedAmount, movement.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </InfoGroup>
      </EtoroScopeGate>
    </div>
  );
}
