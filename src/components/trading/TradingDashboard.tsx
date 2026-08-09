import { useMemo } from 'react';
import { useI18n } from '@/i18n/useI18n';
import { useChartAnimation } from '@/hooks/useChartAnimation';
import {
  selectInstrumentSearchResults,
  selectCuratedLists,
  selectCandlePoints,
  selectPublicUserProfile,
} from '@/services/etoro-discover';
import EtoroOverviewTab from './EtoroOverviewTab';
import EtoroDemoAccountCard from './EtoroDemoAccountCard';
import EtoroMirrorsTab from './EtoroMirrorsTab';
import EtoroHistoryTab from './EtoroHistoryTab';
import EtoroPerformanceTab from './EtoroPerformanceTab';
import EtoroAnalysisTab from './EtoroAnalysisTab';
import EtoroWatchlistsTab from './EtoroWatchlistsTab';
import EtoroNewsTab from './EtoroNewsTab';
import EtoroDiscoverTab from './EtoroDiscoverTab';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingSwap } from '@/components/common/LoadingSwap';
import FinanceErrorState from '@/components/common/FinanceErrorState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PositionTable from './PositionTable';
import PortfolioManager from './PortfolioManager';
import { chartTooltipProps } from '@/lib/chart-tooltip';
import { ChartFigure } from '@/components/common/ChartFigure';
import EtoroConnectDialog from './EtoroConnectDialog';
import AddPositionDialog from './AddPositionDialog';
import OcrImportDialog from './OcrImportDialog';
import ProviderSelector from './ProviderSelector';
import { sumMirrorLiquidationValue } from '@/services/etoro-mirrors';
import { useEtoroAccount } from '@/features/trading/application/use-etoro-account';
import { buildPerformancePreview } from '@/features/trading/domain/performance-preview';
import { useTradingPortfolio } from '@/features/trading/application/use-trading-portfolio';
import {
  TrendingUp,
  RefreshCw,
  Wallet,
  Plus,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Upload,
  Shield,
  FileText,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function TradingDashboard() {
  const { t } = useI18n();
  const chartAnimation = useChartAnimation();
  // Depot-Kern: Depot, Positionen, Kennzahlen, Kursaktualisierung und die
  // Mutationen dazu. Liegt in `features/trading`.
  const {
    activePortfolio,
    positions,
    summary,
    isInitializing,
    isLoadingPortfolio,
    isLoadingPositions,
    hasLoadError,
    retryAll,
    quoteProvider,
    handleProviderChange,
    refreshQuotesMutation,
    lastUpdate,
    etoroSyncMutation,
    isEtoroDialogOpen,
    setIsEtoroDialogOpen,
    isAddPositionDialogOpen,
    startAddPosition,
    handleAddPositionDialogClose,
    isOcrImportDialogOpen,
    setIsOcrImportDialogOpen,
    editPosition,
    handleDeletePosition,
    handleEditPosition,
    handleEtoroSuccess,
    handlePortfolioChange,
  } = useTradingPortfolio();

  // eToro-Bereiche: zwanzig Abfragen über sieben Tabs, samt Tab-, Watchlist-,
  // News- und Discover-Zustand. Liegt in `features/trading` — siehe dort, warum
  // jede Abfrage tab-gattert ist (Rate-Limit von eToro).
  const {
    isEtoro,
    unlocked,
    setActiveTab,
    effectiveTab,
    etoroAggregate,
    isLoadingAggregate,
    aggregateError,
    refetchAggregate,
    localEtoroPositionsValue,
    etoroDemoPnl,
    isLoadingDemoPnl,
    demoPnlError,
    mirrorInstrumentMeta,
    etoroTradeHistory,
    isLoadingTradeHistory,
    tradeHistoryError,
    refetchTradeHistory,
    tradeHistoryInstrumentMeta,
    etoroPnl,
    isLoadingPnl,
    pnlError,
    refetchPnl,
    isLoadingBalances,
    balancesError,
    refetchBalances,
    cashAccountId,
    etoroCashMovements,
    isLoadingCashMovements,
    cashMovementsError,
    refetchCashMovements,
    isLoadingBalancesHistory,
    balancesHistoryError,
    refetchBalancesHistory,
    performanceSeries,
    analysisInstrumentMeta,
    analysisInstrumentIndustryMap,
    analysisIndustryNameMap,
    etoroWatchlists,
    isLoadingWatchlists,
    watchlistsError,
    refetchWatchlists,
    setSelectedWatchlistId,
    effectiveWatchlistId,
    etoroWatchlistItems,
    isLoadingWatchlistItems,
    watchlistItemsError,
    refetchWatchlistItems,
    etoroPriceAlerts,
    isLoadingPriceAlerts,
    priceAlertsError,
    refetchPriceAlerts,
    watchlistsRates,
    newsFilter,
    setNewsFilter,
    etoroNewsFeed,
    isLoadingNewsFeed,
    newsFeedError,
    refetchNewsFeed,
    positionsFeedQueries,
    isLoadingPositionsFeed,
    positionsFeedError,
    refetchPositionsFeed,
    discoverSearchInput,
    setDiscoverSearchInput,
    discoverSearchQuery,
    setDiscoverSearchQuery,
    discoverUsernameInput,
    setDiscoverUsernameInput,
    discoverUsername,
    setDiscoverUsername,
    discoverSelectedInstrument,
    setDiscoverSelectedInstrument,
    etoroInstrumentSearch,
    isLoadingInstrumentSearch,
    instrumentSearchError,
    refetchInstrumentSearch,
    etoroCuratedLists,
    isLoadingCuratedLists,
    curatedListsError,
    refetchCuratedLists,
    etoroInstrumentCandles,
    isLoadingCandles,
    candlesError,
    refetchCandles,
    etoroPublicUserInfo,
    isLoadingPublicUserInfo,
    publicUserInfoError,
    refetchPublicUserInfo,
  } = useEtoroAccount({ portfolio: activePortfolio, positions });

  // Simulierter Verlauf fuer Depots ohne echte Kurshistorie. EINMAL berechnet
  // und deterministisch — die fruehere Fassung wuerfelte je Aufruf neu und
  // wurde zweimal pro Render gerufen, sodass Tabelle und Diagramm verschiedene
  // Zahlen zeigten (siehe features/trading/domain/performance-preview.ts).
  const performancePreview = useMemo(
    () =>
      buildPerformancePreview(
        summary ? { totalCost: summary.total_cost, totalValue: summary.total_value } : null,
      ),
    [summary],
  );

  const performancePreviewLabel = (day: number | null) =>
    day === null
      ? t('trading.dashboard.performanceChart.startLabel')
      : t('trading.dashboard.performanceChart.dayLabel').replace('{n}', String(day));

  // PERF-4: Bisher entstand dieses Array inline im JSX (LineChart-Prop) und
  // damit bei jedem Render neu, auch wenn sich weder performancePreview noch
  // die Uebersetzung geaendert hat. `t` ist in I18nProvider ein stabiles
  // useCallback (deps: [locale, wording]) — als Abhaengigkeit bildet es also
  // exakt die Faelle ab, in denen sich performancePreviewLabel(day) aendern
  // kann (Sprachwechsel, Wording-Wechsel), ohne bei jedem Render neu zu
  // greifen. Wird unconditional auf Top-Level berechnet (auch wenn nur der
  // Nicht-eToro-Zweig sie zeigt) — Hooks duerfen nicht bedingt laufen.
  const performancePreviewChartData = useMemo(
    () => performancePreview.map((point) => ({ ...point, label: performancePreviewLabel(point.day) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- performancePreviewLabel ist reine Funktion von (day, t); t traegt den relevanten State.
    [performancePreview, t],
  );

  if (hasLoadError) {
    return <FinanceErrorState variant="data" onRetry={retryAll} />;
  }

  if (isInitializing || isLoadingPortfolio) {
    // WP-8.4: Choreografie aus WP-7.3. Der Platzhalter zeichnet vor, was
    // kommt — Kopfzeile, Kennzahlenreihe, Positionsliste — statt nur zu
    // sagen, dass etwas passiert.
    return (
      <LoadingSwap
        loading
        skeleton={
          <div data-testid="trading-dashboard-skeleton" className="space-y-6">
            <Skeleton variant="shimmer" className="h-8 w-56" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} variant="shimmer" className="h-24 w-full rounded-lg" />
              ))}
            </div>
            <Skeleton variant="shimmer" className="h-64 w-full rounded-lg" />
          </div>
        }
      >
        {null}
      </LoadingSwap>
    );
  }

  return (
    <div className="space-y-6">
      {/* Privacy Banner */}
      <Alert className="border-primary/50 bg-primary/5">
        <Shield className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>🔒 {t('trading.dashboard.privacyModeTitle')}</strong> {t('trading.dashboard.privacyModeDesc')}
          {positions && positions.length > 0 && (
            <>
              <br />
              <span className="text-xs text-muted-foreground">
                💡 {t('trading.dashboard.pricesManualEditHint')}
              </span>
            </>
          )}
        </AlertDescription>
      </Alert>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('trading.dashboard.title')}</h1>
          <p className="text-muted-foreground">
            {t('trading.dashboard.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProviderSelector
            currentProvider={quoteProvider}
            onProviderChange={handleProviderChange}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshQuotesMutation.mutate()}
            disabled={refreshQuotesMutation.isPending || !positions || positions.length === 0}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshQuotesMutation.isPending ? 'animate-spin' : ''}`} />
            {t('trading.dashboard.refreshPrices')}
          </Button>
          <Button
            size="sm"
            onClick={startAddPosition}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('trading.dashboard.addPosition')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOcrImportDialogOpen(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            {t('trading.dashboard.importImage')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast(t('trading.dashboard.csvComingSoon'))}
            title={t('trading.dashboard.csvComingSoon')}
          >
            <FileText className="h-4 w-4 mr-2" />
            {t('trading.dashboard.importCsv')}
          </Button>
          {activePortfolio?.type === 'etoro' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => etoroSyncMutation.mutate()}
              disabled={etoroSyncMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${etoroSyncMutation.isPending ? 'animate-spin' : ''}`} />
              {t('trading.dashboard.syncEtoro')}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setIsEtoroDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('trading.dashboard.connectEtoro')}
          </Button>
        </div>
      </div>

      {/* Live Update Status */}
      {lastUpdate && (
        <Alert>
          <Activity className="h-4 w-4" />
          <AlertDescription>
            {t('trading.dashboard.lastUpdated')
              .replace('{time}', lastUpdate.toLocaleTimeString('de-DE'))
              .replace('{provider}', quoteProvider.toUpperCase())}
            <Badge variant="outline" className="ml-1">{quoteProvider.toUpperCase()}</Badge>
          </AlertDescription>
        </Alert>
      )}

      {/* Portfolio Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('trading.dashboard.summary.totalValue')}</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.total_value, summary.currency)}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('trading.dashboard.summary.positionsCount').replace('{count}', String(summary.positions_count))}
              </p>
              {isEtoro && (
                <p className="text-xs text-muted-foreground">{t('trading.etoro.overview.totalValueHint')}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('trading.dashboard.summary.invested')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.total_cost, summary.currency)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('trading.dashboard.summary.gainLoss')}</CardTitle>
              {summary.unrealized_gain_loss >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-positive dark:text-positive" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-warning dark:text-warning" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                summary.unrealized_gain_loss >= 0
                  ? 'text-positive dark:text-positive'
                  : 'text-warning dark:text-warning'
              }`}>
                {summary.unrealized_gain_loss >= 0 ? '+' : ''}
                {formatCurrency(summary.unrealized_gain_loss, summary.currency)}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.unrealized_gain_loss_percent >= 0 ? '+' : ''}
                {summary.unrealized_gain_loss_percent.toFixed(2)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('trading.dashboard.summary.return')}</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                summary.unrealized_gain_loss_percent >= 0
                  ? 'text-positive dark:text-positive'
                  : 'text-warning dark:text-warning'
              }`}>
                {summary.unrealized_gain_loss_percent >= 0 ? '+' : ''}
                {summary.unrealized_gain_loss_percent.toFixed(2)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {t('trading.dashboard.summary.unrealizedReturn')}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs
        value={effectiveTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        {/* Horizontal scrollbar, damit die eToro-Tabs auch mobil vollständig
            erreichbar bleiben; Fade-Kante rechts signalisiert weitere Tabs. */}
        <div className="-mx-1 overflow-x-auto px-1 [-webkit-overflow-scrolling:touch] [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)]">
          <TabsList className="w-max flex-nowrap">
            {isEtoro && (
              <TabsTrigger value="overview" className="shrink-0">{t('trading.etoro.tabs.overview')}</TabsTrigger>
            )}
            {isEtoro && (
              <TabsTrigger value="mirrors" className="shrink-0">{t('trading.etoro.tabs.mirrors')}</TabsTrigger>
            )}
            {isEtoro && (
              <TabsTrigger value="history" className="shrink-0">{t('trading.etoro.tabs.history')}</TabsTrigger>
            )}
            {isEtoro && (
              <TabsTrigger value="analysis" className="shrink-0">{t('trading.etoro.tabs.analysis')}</TabsTrigger>
            )}
            {isEtoro && (
              <TabsTrigger value="watchlists" className="shrink-0">{t('trading.etoro.tabs.watchlists')}</TabsTrigger>
            )}
            {isEtoro && (
              <TabsTrigger value="news" className="shrink-0">{t('trading.etoro.tabs.news')}</TabsTrigger>
            )}
            {isEtoro && (
              <TabsTrigger value="discover" className="shrink-0">{t('trading.etoro.tabs.discover')}</TabsTrigger>
            )}
            <TabsTrigger value="positions" className="shrink-0">{t('trading.dashboard.tabs.positions')}</TabsTrigger>
            <TabsTrigger value="performance" className="shrink-0">{t('trading.dashboard.tabs.performance')}</TabsTrigger>
            <TabsTrigger value="portfolios" className="shrink-0">{t('trading.dashboard.tabs.portfolios')}</TabsTrigger>
          </TabsList>
        </div>

        {isEtoro && (
          <TabsContent value="overview" className="space-y-4">
            <EtoroOverviewTab
              isLocked={!unlocked}
              isLoading={isLoadingAggregate}
              error={aggregateError as Error | null}
              onRetry={() => refetchAggregate()}
              aggregate={etoroAggregate}
              localPositionsValue={localEtoroPositionsValue}
              mirrorsValue={sumMirrorLiquidationValue(etoroAggregate)}
            />
            <EtoroDemoAccountCard isLoading={isLoadingDemoPnl} error={demoPnlError as Error | null} pnl={etoroDemoPnl} />
          </TabsContent>
        )}

        {isEtoro && (
          <TabsContent value="mirrors" className="space-y-4">
            <EtoroMirrorsTab
              isLocked={!unlocked}
              isLoading={isLoadingAggregate}
              error={aggregateError as Error | null}
              onRetry={() => refetchAggregate()}
              aggregate={etoroAggregate}
              instrumentMeta={mirrorInstrumentMeta}
            />
          </TabsContent>
        )}

        {isEtoro && (
          <TabsContent value="history" className="space-y-4">
            <EtoroHistoryTab
              isLocked={!unlocked}
              pnl={{
                data: etoroPnl,
                isLoading: isLoadingPnl,
                error: pnlError as Error | null,
                onRetry: () => refetchPnl(),
              }}
              tradeHistory={{
                data: etoroTradeHistory,
                isLoading: isLoadingTradeHistory,
                error: tradeHistoryError as Error | null,
                onRetry: () => refetchTradeHistory(),
              }}
              cashMovements={{
                data: etoroCashMovements,
                isLoading: isLoadingBalances || isLoadingCashMovements,
                error: (balancesError as Error | null) ?? (cashMovementsError as Error | null),
                onRetry: () => {
                  refetchBalances();
                  if (cashAccountId) refetchCashMovements();
                },
              }}
              instrumentMeta={tradeHistoryInstrumentMeta}
            />
          </TabsContent>
        )}

        {isEtoro && (
          <TabsContent value="analysis" className="space-y-4">
            <EtoroAnalysisTab
              isLocked={!unlocked}
              isLoading={isLoadingAggregate}
              error={aggregateError as Error | null}
              onRetry={() => refetchAggregate()}
              aggregate={etoroAggregate}
              instrumentIndustryMap={analysisInstrumentIndustryMap}
              industryNameMap={analysisIndustryNameMap ?? new Map()}
              instrumentMeta={analysisInstrumentMeta}
            />
          </TabsContent>
        )}

        {isEtoro && (
          <TabsContent value="watchlists" className="space-y-4">
            <EtoroWatchlistsTab
              isLocked={!unlocked}
              watchlists={{
                data: etoroWatchlists,
                isLoading: isLoadingWatchlists,
                error: watchlistsError as Error | null,
                onRetry: () => refetchWatchlists(),
              }}
              selectedWatchlistId={effectiveWatchlistId}
              onSelectWatchlist={setSelectedWatchlistId}
              watchlistItems={{
                data: etoroWatchlistItems,
                isLoading: isLoadingWatchlistItems,
                error: watchlistItemsError as Error | null,
                onRetry: () => refetchWatchlistItems(),
              }}
              priceAlerts={{
                data: etoroPriceAlerts,
                isLoading: isLoadingPriceAlerts,
                error: priceAlertsError as Error | null,
                onRetry: () => refetchPriceAlerts(),
              }}
              rates={watchlistsRates ?? new Map()}
            />
          </TabsContent>
        )}

        {isEtoro && (
          <TabsContent value="news" className="space-y-4">
            <EtoroNewsTab
              isLocked={!unlocked}
              filter={newsFilter}
              onFilterChange={setNewsFilter}
              newsFeed={{
                data: etoroNewsFeed,
                isLoading: isLoadingNewsFeed,
                error: newsFeedError as Error | null,
                onRetry: () => refetchNewsFeed(),
              }}
              positionsFeed={{
                responses: positionsFeedQueries.map((q) => q.data),
                isLoading: isLoadingPositionsFeed,
                error: positionsFeedError as Error | null,
                onRetry: refetchPositionsFeed,
              }}
            />
          </TabsContent>
        )}

        {isEtoro && (
          <TabsContent value="discover" className="space-y-4">
            <EtoroDiscoverTab
              isLocked={!unlocked}
              searchQuery={discoverSearchInput}
              onSearchQueryChange={setDiscoverSearchInput}
              onSearchSubmit={() => setDiscoverSearchQuery(discoverSearchInput.trim())}
              searchResults={selectInstrumentSearchResults(etoroInstrumentSearch)}
              searchState={{
                isLoading: isLoadingInstrumentSearch,
                error: instrumentSearchError as Error | null,
                onRetry: () => refetchInstrumentSearch(),
                hasSearched: discoverSearchQuery.length > 0,
              }}
              curatedLists={selectCuratedLists(etoroCuratedLists)}
              curatedListsState={{
                isLoading: isLoadingCuratedLists,
                error: curatedListsError as Error | null,
                onRetry: () => refetchCuratedLists(),
              }}
              selectedInstrument={discoverSelectedInstrument}
              onSelectInstrument={setDiscoverSelectedInstrument}
              candles={selectCandlePoints(etoroInstrumentCandles)}
              candlesState={{
                isLoading: isLoadingCandles,
                error: candlesError as Error | null,
                onRetry: () => refetchCandles(),
              }}
              usernameQuery={discoverUsernameInput}
              onUsernameQueryChange={setDiscoverUsernameInput}
              onUsernameSubmit={() => setDiscoverUsername(discoverUsernameInput.trim())}
              userProfile={selectPublicUserProfile(etoroPublicUserInfo)}
              userProfileState={{
                isLoading: isLoadingPublicUserInfo,
                error: publicUserInfoError as Error | null,
                onRetry: () => refetchPublicUserInfo(),
                hasSearched: discoverUsername.length > 0,
              }}
            />
          </TabsContent>
        )}

        <TabsContent value="positions" className="space-y-4">
          {isLoadingPositions ? (
            // WP-8.4: Zeilen in der Form der Positionstabelle statt eines
            // kreisenden Symbols.
            <LoadingSwap
              loading
              skeleton={
                <div data-testid="trading-positions-skeleton" className="space-y-2">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} variant="shimmer" className="h-12 w-full" />
                  ))}
                </div>
              }
            >
              {null}
            </LoadingSwap>
          ) : (
            <PositionTable
              positions={positions || []}
              onEdit={handleEditPosition}
              onDelete={handleDeletePosition}
              currency={activePortfolio?.currency || 'EUR'}
            />
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {isEtoro ? (
            // eToro-Portfolios zeigen den echten Kontostand-Verlauf
            // (/balances/history) — nie mehr den synthetischen Mock unten.
            <EtoroPerformanceTab
              isLocked={!unlocked}
              isLoading={isLoadingBalancesHistory}
              error={balancesHistoryError as Error | null}
              onRetry={() => refetchBalancesHistory()}
              series={performanceSeries}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t('trading.dashboard.performanceChart.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                {/* WP-6.10: Werte auch ohne Diagramm zugaenglich. */}
                <ChartFigure
                  caption={t('trading.dashboard.performanceChart.valueLabel')}
                  columns={[
                    { key: 'day', label: t('balanceChart.dateColumn'), format: (row) => performancePreviewLabel(row.day) },
                    {
                      key: 'value',
                      label: t('trading.dashboard.performanceChart.valueLabel'),
                      numeric: true,
                      format: (row) => formatCurrency(row.value, 'EUR'),
                    },
                  ]}
                  rows={performancePreview}
                  rowKey={(row, index) => `${row.day ?? 'start'}-${index}`}
                >
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performancePreviewChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip
                      {...chartTooltipProps({
                        formatValue: (value) => formatCurrency(value, 'EUR'),
                        seriesLabels: { value: t('trading.dashboard.performanceChart.valueLabel') },
                      })}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={chartAnimation.animate}
                      animationDuration={chartAnimation.animationDuration}
                      animationEasing={chartAnimation.animationEasing}
                    />
                  </LineChart>
                </ResponsiveContainer>
                </ChartFigure>
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  {t('trading.dashboard.performanceChart.disclaimer')}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="portfolios" className="space-y-4">
          <PortfolioManager
            activePortfolioId={activePortfolio?.id}
            onPortfolioChange={handlePortfolioChange}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <EtoroConnectDialog
        open={isEtoroDialogOpen}
        onOpenChange={setIsEtoroDialogOpen}
        onSuccess={handleEtoroSuccess}
      />
      <AddPositionDialog
        open={isAddPositionDialogOpen}
        onOpenChange={handleAddPositionDialogClose}
        portfolioId={activePortfolio?.id || ''}
        editPosition={editPosition}
      />
      <OcrImportDialog
        open={isOcrImportDialogOpen}
        onOpenChange={setIsOcrImportDialogOpen}
        portfolioId={activePortfolio?.id || ''}
      />
    </div>
  );
}