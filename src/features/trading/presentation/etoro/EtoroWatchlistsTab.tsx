import { Star, Bell } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import { formatCurrency } from '@/lib/utils';
import EmptyState from '@/components/common/EmptyState';
import { InfoGroup } from '@/components/common/InfoGroup';
import SegmentedControl from '@/components/common/SegmentedControl';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { EtoroWatchlistsResponse, EtoroPriceAlertsResponse } from '@/services/etoro-api-schemas';
import { selectWatchlistSummaries, selectWatchlistItems, selectPriceAlerts } from '@/services/etoro-watchlists';
import EtoroScopeGate from './EtoroScopeGate';

interface EtoroWatchlistsSectionState<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

interface EtoroWatchlistsTabProps {
  isLocked: boolean;
  watchlists: EtoroWatchlistsSectionState<EtoroWatchlistsResponse>;
  selectedWatchlistId: string | undefined;
  onSelectWatchlist: (watchlistId: string) => void;
  watchlistItems: EtoroWatchlistsSectionState<EtoroWatchlistsResponse>;
  priceAlerts: EtoroWatchlistsSectionState<EtoroPriceAlertsResponse>;
  /** instrumentId → Live-Kurs, aus dem bestehenden fetchEtoroRates. */
  rates: Map<number, number>;
}

// eToro-Konten laufen in USD — nie das EUR-Default.
const USD = 'USD';
const fmt = (v: number) => formatCurrency(v, USD);

/**
 * Watchlists- & Kursalarm-Tab für eToro-Portfolios (read-only). Zwei
 * unabhängige Datenquellen (Watchlists+Items, Kursalarme) — jeweils eigenes
 * EtoroScopeGate, plus ein drittes für die Item-Detailabfrage der aktuell
 * ausgewählten Watchlist (eigene Rate-Limit-Gruppe/Ladezustand).
 */
export default function EtoroWatchlistsTab({
  isLocked,
  watchlists,
  selectedWatchlistId,
  onSelectWatchlist,
  watchlistItems,
  priceAlerts,
  rates,
}: EtoroWatchlistsTabProps) {
  const { t } = useI18n();

  if (isLocked) {
    return (
      <EtoroScopeGate isLocked isLoading={false} error={null}>
        <></>
      </EtoroScopeGate>
    );
  }

  const summaries = selectWatchlistSummaries(watchlists.data);
  const items = selectWatchlistItems(watchlistItems.data, rates);
  const alerts = selectPriceAlerts(priceAlerts.data, rates);

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-medium text-muted-foreground">{t('trading.etoro.watchlists.title')}</h2>

      <EtoroScopeGate isLocked={false} isLoading={watchlists.isLoading} error={watchlists.error} onRetry={watchlists.onRetry}>
        <InfoGroup title={t('trading.etoro.watchlists.watchlistsSection')}>
          {summaries.length === 0 ? (
            <EmptyState
              icon={Star}
              title={t('trading.etoro.watchlists.emptyTitle')}
              description={t('trading.etoro.watchlists.emptyDesc')}
            />
          ) : (
            <div className="space-y-4">
              {summaries.length > 1 && (
                <SegmentedControl
                  aria-label={t('trading.etoro.watchlists.watchlistsSection')}
                  value={selectedWatchlistId ?? summaries[0].watchlistId}
                  onValueChange={onSelectWatchlist}
                  options={summaries.map((w) => ({
                    value: w.watchlistId,
                    label: `${w.name} (${w.itemCount})`,
                  }))}
                />
              )}

              <EtoroScopeGate
                isLocked={false}
                isLoading={watchlistItems.isLoading}
                error={watchlistItems.error}
                onRetry={watchlistItems.onRetry}
              >
                {items.length === 0 ? (
                  <EmptyState
                    icon={Star}
                    title={t('trading.etoro.watchlists.itemsEmptyTitle')}
                    description={t('trading.etoro.watchlists.itemsEmptyDesc')}
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('trading.etoro.watchlists.columnInstrument')}</TableHead>
                        <TableHead className="text-right">{t('trading.etoro.watchlists.columnPrice')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.itemId}>
                          <TableCell className="font-medium">
                            {item.name ||
                              item.symbol ||
                              t('trading.etoro.watchlists.instrumentFallback').replace('{id}', String(item.itemId))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {item.price != null ? fmt(item.price) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </EtoroScopeGate>
            </div>
          )}
        </InfoGroup>
      </EtoroScopeGate>

      <EtoroScopeGate isLocked={false} isLoading={priceAlerts.isLoading} error={priceAlerts.error} onRetry={priceAlerts.onRetry}>
        <InfoGroup title={t('trading.etoro.watchlists.alertsSection')}>
          {alerts.length === 0 ? (
            <EmptyState
              icon={Bell}
              title={t('trading.etoro.watchlists.alertsEmptyTitle')}
              description={t('trading.etoro.watchlists.alertsEmptyDesc')}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('trading.etoro.watchlists.columnInstrument')}</TableHead>
                  <TableHead className="text-right">{t('trading.etoro.watchlists.columnTargetPrice')}</TableHead>
                  <TableHead className="text-right">{t('trading.etoro.watchlists.columnCurrentPrice')}</TableHead>
                  <TableHead className="text-right">{t('trading.etoro.watchlists.columnDistance')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.alertId}>
                    <TableCell className="font-medium">{alert.symbol}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(alert.targetPrice)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(alert.livePrice ?? alert.currentPrice)}</TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-medium ${
                        alert.distancePercent <= 0 ? 'text-positive' : 'text-muted-foreground'
                      }`}
                    >
                      {alert.distancePercent >= 0 ? '+' : ''}
                      {alert.distancePercent.toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </InfoGroup>
      </EtoroScopeGate>
    </div>
  );
}
