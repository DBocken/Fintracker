import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n/useI18n';
import type { Portfolio, PortfolioPosition } from '@/types';
import {
  getActivePortfolio,
  getPositions,
  getPortfolioSummary,
  initializeDemoPortfolio,
  batchUpdatePrices,
  deletePosition,
} from '@/services/portfolio-service';
import { fetchQuotesCached, normalizeSymbol, mapQuotesToPriceUpdates, isEtoroPosition } from '@/services/quote-service';
import { syncEtoroPortfolio } from '@/services/etoro-service';
import {
  fetchEtoroAggregateForPortfolio,
  fetchEtoroTradeHistoryForPortfolio,
  fetchEtoroPnlForPortfolio,
  fetchEtoroBalancesForPortfolio,
  fetchEtoroBalancesHistoryForPortfolio,
  fetchEtoroCashTransactionsForPortfolio,
  fetchEtoroWatchlistsForPortfolio,
  fetchEtoroWatchlistItemsForPortfolio,
  fetchEtoroPriceAlertsForPortfolio,
  fetchEtoroNewsFeedForPortfolio,
  fetchEtoroMarketFeedForPortfolio,
} from '@/services/etoro-account-service';
import { getEtoroCredentials, fetchEtoroInstrumentMeta, fetchEtoroStocksIndustries, fetchEtoroRates } from '@/services/etoro-service';
import { selectEtoroMirrors, sumMirrorLiquidationValue } from '@/services/etoro-mirrors';
import { selectCashAccountId, selectPerformanceSeries } from '@/services/etoro-performance';
import { selectWatchlistSummaries, selectWatchlistItems } from '@/services/etoro-watchlists';
import { useLocalEncryption } from '@/components/providers/LocalEncryptionProvider';
import EtoroOverviewTab from './EtoroOverviewTab';
import EtoroMirrorsTab from './EtoroMirrorsTab';
import EtoroHistoryTab from './EtoroHistoryTab';
import EtoroPerformanceTab from './EtoroPerformanceTab';
import EtoroAnalysisTab from './EtoroAnalysisTab';
import EtoroWatchlistsTab from './EtoroWatchlistsTab';
import EtoroNewsTab, { type EtoroNewsFilter } from './EtoroNewsTab';
import { getPreferredMarketProvider } from '@/services/user-settings-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PositionTable from './PositionTable';
import PortfolioManager from './PortfolioManager';
import EtoroConnectDialog from './EtoroConnectDialog';
import AddPositionDialog from './AddPositionDialog';
import OcrImportDialog from './OcrImportDialog';
import ProviderSelector from './ProviderSelector';
import {
  TrendingUp,
  RefreshCw,
  Wallet,
  Plus,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
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
  const queryClient = useQueryClient();
  const [activePortfolio, setActivePortfolio] = useState<Portfolio | null>(null);
  const [isEtoroDialogOpen, setIsEtoroDialogOpen] = useState(false);
  const [isAddPositionDialogOpen, setIsAddPositionDialogOpen] = useState(false);
  const [isOcrImportDialogOpen, setIsOcrImportDialogOpen] = useState(false);
  const [editPosition, setEditPosition] = useState<PortfolioPosition | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Load preferred market provider from user settings
  const { data: preferredProvider = 'yahoo' } = useQuery({
    queryKey: ['preferred-market-provider'],
    queryFn: getPreferredMarketProvider,
    staleTime: Infinity,
  });
  
  const [quoteProvider, setQuoteProvider] = useState<'yahoo' | 'stooq'>(preferredProvider || 'yahoo');

  // Update quote provider when preferred provider changes
  useEffect(() => {
    setQuoteProvider(preferredProvider);
  }, [preferredProvider]);

  // Initialize demo portfolio if none exists
  const { data: hasInitialized, isLoading: isInitializing } = useQuery({
    queryKey: ['portfolio-initialization'],
    queryFn: async () => {
      const portfolio = await initializeDemoPortfolio();
      return portfolio;
    },
    staleTime: Infinity,
  });

  // Get active portfolio
  const { data: portfolio, isLoading: isLoadingPortfolio } = useQuery({
    queryKey: ['active-portfolio'],
    queryFn: getActivePortfolio,
    enabled: !!hasInitialized,
  });

  // Update active portfolio when portfolio data changes
  useEffect(() => {
    if (portfolio) {
      setActivePortfolio(portfolio);
    }
  }, [portfolio]);

  // Get positions for active portfolio
  const { data: positions, isLoading: isLoadingPositions } = useQuery({
    queryKey: ['portfolio-positions', activePortfolio?.id],
    queryFn: () => getPositions(activePortfolio!.id),
    enabled: !!activePortfolio?.id,
  });

  // Get portfolio summary
  const { data: summary } = useQuery({
    queryKey: ['portfolio-summary', activePortfolio?.id],
    queryFn: () => getPortfolioSummary(activePortfolio!.id),
    enabled: !!activePortfolio?.id,
  });

  // eToro-spezifische Tabs & Live-Konto-Snapshot
  const { unlocked } = useLocalEncryption();
  const isEtoro = activePortfolio?.type === 'etoro';

  // Kontrollierter Tab-State: null = Standard je Portfolio-Typ (eToro →
  // Übersicht, sonst Positionen). Bei Portfolio-Wechsel zurücksetzen.
  const [activeTab, setActiveTab] = useState<string | null>(null);
  useEffect(() => {
    setActiveTab(null);
  }, [activePortfolio?.id]);
  const effectiveTab = activeTab ?? (isEtoro ? 'overview' : 'positions');

  // Ausgewählte Watchlist im Watchlists-Tab — null = Standard (isDefault/erste
  // Watchlist). Bei Portfolio-Wechsel zurücksetzen wie activeTab.
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null);
  useEffect(() => {
    setSelectedWatchlistId(null);
  }, [activePortfolio?.id]);

  // Filter im News-Tab ("Alle" vs. "Meine Positionen"). Bei Portfolio-Wechsel
  // zurücksetzen wie activeTab.
  const [newsFilter, setNewsFilter] = useState<EtoroNewsFilter>('all');
  useEffect(() => {
    setNewsFilter('all');
  }, [activePortfolio?.id]);

  // Konto-Snapshot (Cash, Totals, Mirrors) — Live-View, nur bei aktivem
  // Übersicht-Tab und entsperrter Verschlüsselung. staleTime 60 s wegen des
  // geteilten Portfolio-Gruppen-Rate-Limits (60 req/60 s).
  const {
    data: etoroAggregate,
    isLoading: isLoadingAggregate,
    error: aggregateError,
    refetch: refetchAggregate,
  } = useQuery({
    queryKey: ['etoro-aggregate', activePortfolio?.id],
    queryFn: () => fetchEtoroAggregateForPortfolio(activePortfolio),
    enabled:
      !!activePortfolio?.id &&
      isEtoro &&
      unlocked &&
      (effectiveTab === 'overview' || effectiveTab === 'mirrors' || effectiveTab === 'analysis'),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Instrument-Symbole/-Namen für die im Smart-Portfolios-Tab aufgeklappte
  // Instrumentenliste. Eigene, separat gecachte Query (5 min staleTime — diese
  // Metadaten ändern sich praktisch nie), nur bei Bedarf (Tab aktiv + Mirrors
  // mit Instrumenten vorhanden). Fehler defensiv: leere Map statt Absturz, da
  // Namen nur nice-to-have sind (Fallback "Instrument #<id>" im Tab selbst).
  const mirrorInstrumentIds = useMemo(
    () => selectEtoroMirrors(etoroAggregate).flatMap((m) => m.instrumentIds),
    [etoroAggregate],
  );

  const { data: mirrorInstrumentMeta } = useQuery({
    queryKey: ['etoro-mirror-instruments', activePortfolio?.id],
    queryFn: async () => {
      try {
        const { apiKey, userKey } = getEtoroCredentials(activePortfolio);
        return await fetchEtoroInstrumentMeta(apiKey, userKey, mirrorInstrumentIds);
      } catch (err) {
        console.error('[TradingDashboard] Mirror-Instrument-Auflösung fehlgeschlagen:', err);
        return new Map();
      }
    },
    enabled:
      !!activePortfolio?.id &&
      isEtoro &&
      unlocked &&
      effectiveTab === 'mirrors' &&
      mirrorInstrumentIds.length > 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Geschlossene Trades (Historie-Tab) — MVP: eine Seite (200 Trades, siehe
  // fetchEtoroTradeHistory-Default) ohne Nachlade-Paginierung. staleTime 5 min:
  // historische Daten ändern sich selten, und der Endpoint teilt sich den
  // "Default"-Rate-Limit-Pool mit vielen anderen eToro-Endpoints.
  const {
    data: etoroTradeHistory,
    isLoading: isLoadingTradeHistory,
    error: tradeHistoryError,
    refetch: refetchTradeHistory,
  } = useQuery({
    queryKey: ['etoro-trade-history', activePortfolio?.id],
    queryFn: () => fetchEtoroTradeHistoryForPortfolio(activePortfolio),
    enabled: !!activePortfolio?.id && isEtoro && unlocked && effectiveTab === 'history',
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Konto-P&L (Historie-Tab) — teilt sich die Portfolio-Gruppe (60 req/60 s)
  // mit aggregate-portfolio/portfolio, daher dieselbe staleTime.
  const {
    data: etoroPnl,
    isLoading: isLoadingPnl,
    error: pnlError,
    refetch: refetchPnl,
  } = useQuery({
    queryKey: ['etoro-pnl', activePortfolio?.id],
    queryFn: () => fetchEtoroPnlForPortfolio(activePortfolio),
    enabled: !!activePortfolio?.id && isEtoro && unlocked && effectiveTab === 'history',
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Instrument-Symbole/-Namen für die Trade-Zeilen im Historie-Tab — analog
  // mirrorInstrumentMeta oben (eigene Query, Fehler defensiv auf leere Map).
  const tradeHistoryInstrumentIds = useMemo(
    () => (etoroTradeHistory ?? []).map((trade) => trade.instrumentId),
    [etoroTradeHistory],
  );

  const { data: tradeHistoryInstrumentMeta } = useQuery({
    queryKey: ['etoro-trade-history-instruments', activePortfolio?.id],
    queryFn: async () => {
      try {
        const { apiKey, userKey } = getEtoroCredentials(activePortfolio);
        return await fetchEtoroInstrumentMeta(apiKey, userKey, tradeHistoryInstrumentIds);
      } catch (err) {
        console.error('[TradingDashboard] Trade-History-Instrument-Auflösung fehlgeschlagen:', err);
        return new Map();
      }
    },
    enabled:
      !!activePortfolio?.id &&
      isEtoro &&
      unlocked &&
      effectiveTab === 'history' &&
      tradeHistoryInstrumentIds.length > 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Aggregierte Kontostände (/balances) — nur zur Auflösung der Cash-Account-ID
  // fürs Cash-Bewegungen-Segment im Historie-Tab (die Portfolio-/Aggregate-
  // Antworten kennen sie nicht).
  const {
    data: etoroBalances,
    isLoading: isLoadingBalances,
    error: balancesError,
    refetch: refetchBalances,
  } = useQuery({
    queryKey: ['etoro-balances', activePortfolio?.id],
    queryFn: () => fetchEtoroBalancesForPortfolio(activePortfolio),
    enabled: !!activePortfolio?.id && isEtoro && unlocked && effectiveTab === 'history',
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const cashAccountId = useMemo(() => selectCashAccountId(etoroBalances), [etoroBalances]);

  // Cash-Konto-Bewegungen (Historie-Tab, „Cash-Bewegungen"-Segment) — erst
  // aktivierbar, sobald die Cash-Account-ID aus /balances aufgelöst ist.
  const {
    data: etoroCashMovements,
    isLoading: isLoadingCashMovements,
    error: cashMovementsError,
    refetch: refetchCashMovements,
  } = useQuery({
    queryKey: ['etoro-cash-transactions', activePortfolio?.id, cashAccountId],
    queryFn: () => fetchEtoroCashTransactionsForPortfolio(activePortfolio, cashAccountId!),
    enabled: !!activePortfolio?.id && isEtoro && unlocked && effectiveTab === 'history' && !!cashAccountId,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Tägliche Kontostand-Snapshots (Performance-Tab) — ersetzt den bisherigen
  // synthetischen Mock. eToro-Default (letzte 30 Tage) wird nicht überschrieben.
  const {
    data: etoroBalancesHistory,
    isLoading: isLoadingBalancesHistory,
    error: balancesHistoryError,
    refetch: refetchBalancesHistory,
  } = useQuery({
    queryKey: ['etoro-balances-history', activePortfolio?.id],
    queryFn: () => fetchEtoroBalancesHistoryForPortfolio(activePortfolio),
    enabled: !!activePortfolio?.id && isEtoro && unlocked && effectiveTab === 'performance',
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const performanceSeries = useMemo(() => selectPerformanceSeries(etoroBalancesHistory), [etoroBalancesHistory]);

  // Instrument-Metadaten für ALLE Instrument-Aggregate (Analyse-Tab) — anders
  // als mirrorInstrumentMeta/tradeHistoryInstrumentMeta wird hier zusätzlich
  // stocksIndustryId benötigt (Grundlage der Sektor-Exposure).
  const analysisInstrumentIds = useMemo(
    () => (etoroAggregate?.instrumentAggregates ?? []).map((inst) => inst.instrumentId),
    [etoroAggregate],
  );

  const { data: analysisInstrumentMeta } = useQuery({
    queryKey: ['etoro-analysis-instruments', activePortfolio?.id],
    queryFn: async () => {
      try {
        const { apiKey, userKey } = getEtoroCredentials(activePortfolio);
        return await fetchEtoroInstrumentMeta(apiKey, userKey, analysisInstrumentIds);
      } catch (err) {
        console.error('[TradingDashboard] Analyse-Instrument-Auflösung fehlgeschlagen:', err);
        return new Map();
      }
    },
    enabled:
      !!activePortfolio?.id &&
      isEtoro &&
      unlocked &&
      effectiveTab === 'analysis' &&
      analysisInstrumentIds.length > 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const analysisInstrumentIndustryMap = useMemo(() => {
    const map = new Map<number, number | undefined>();
    analysisInstrumentMeta?.forEach((meta, instrumentId) => map.set(instrumentId, meta.stocksIndustryId));
    return map;
  }, [analysisInstrumentMeta]);

  const analysisIndustryIds = useMemo(
    () => [...new Set([...analysisInstrumentIndustryMap.values()].filter((id): id is number => id != null))],
    [analysisInstrumentIndustryMap],
  );

  // Branchennamen je stocksIndustryId — eigene Query, da erst nach der
  // Instrument-Auflösung bekannt, welche Branchen überhaupt vorkommen.
  const { data: analysisIndustryNameMap } = useQuery({
    queryKey: ['etoro-stocks-industries', activePortfolio?.id, analysisIndustryIds],
    queryFn: async () => {
      try {
        const { apiKey, userKey } = getEtoroCredentials(activePortfolio);
        return await fetchEtoroStocksIndustries(apiKey, userKey, analysisIndustryIds);
      } catch (err) {
        console.error('[TradingDashboard] Branchen-Auflösung fehlgeschlagen:', err);
        return new Map();
      }
    },
    enabled:
      !!activePortfolio?.id &&
      isEtoro &&
      unlocked &&
      effectiveTab === 'analysis' &&
      analysisIndustryIds.length > 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Liste aller Watchlists (Namen/Metadaten, Watchlists-Tab) — teilt sich eine
  // Rate-Limit-Gruppe mit der Einzelabfrage unten.
  const {
    data: etoroWatchlists,
    isLoading: isLoadingWatchlists,
    error: watchlistsError,
    refetch: refetchWatchlists,
  } = useQuery({
    queryKey: ['etoro-watchlists', activePortfolio?.id],
    queryFn: () => fetchEtoroWatchlistsForPortfolio(activePortfolio),
    enabled: !!activePortfolio?.id && isEtoro && unlocked && effectiveTab === 'watchlists',
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const watchlistSummaries = useMemo(() => selectWatchlistSummaries(etoroWatchlists), [etoroWatchlists]);
  const effectiveWatchlistId =
    selectedWatchlistId ?? watchlistSummaries.find((w) => w.isDefault)?.watchlistId ?? watchlistSummaries[0]?.watchlistId;

  // Voll paginierte Items der ausgewählten Watchlist — eigene Abfrage, da die
  // Sammelabfrage oben Items je Watchlist auf itemsPerPageForSingle begrenzt.
  const {
    data: etoroWatchlistItems,
    isLoading: isLoadingWatchlistItems,
    error: watchlistItemsError,
    refetch: refetchWatchlistItems,
  } = useQuery({
    queryKey: ['etoro-watchlist-items', activePortfolio?.id, effectiveWatchlistId],
    queryFn: () => fetchEtoroWatchlistItemsForPortfolio(activePortfolio, effectiveWatchlistId!),
    enabled: !!activePortfolio?.id && isEtoro && unlocked && effectiveTab === 'watchlists' && !!effectiveWatchlistId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Aktive Kursalarme (Watchlists-Tab) — eigener "Default"-Rate-Limit-Pool.
  const {
    data: etoroPriceAlerts,
    isLoading: isLoadingPriceAlerts,
    error: priceAlertsError,
    refetch: refetchPriceAlerts,
  } = useQuery({
    queryKey: ['etoro-price-alerts', activePortfolio?.id],
    queryFn: () => fetchEtoroPriceAlertsForPortfolio(activePortfolio),
    enabled: !!activePortfolio?.id && isEtoro && unlocked && effectiveTab === 'watchlists',
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Live-Kurse für Watchlist-Items + Kursalarm-Instrumente — über den
  // bestehenden fetchEtoroRates (kollisionsfrei ggü. Yahoo-Tickern).
  const watchlistsRateInstrumentIds = useMemo(() => {
    const fromItems = selectWatchlistItems(etoroWatchlistItems, new Map()).map((item) => item.itemId);
    const fromAlerts = (etoroPriceAlerts?.results ?? []).map((alert) => alert.instrumentId);
    return [...new Set([...fromItems, ...fromAlerts])];
  }, [etoroWatchlistItems, etoroPriceAlerts]);

  const { data: watchlistsRates } = useQuery({
    queryKey: ['etoro-watchlists-rates', activePortfolio?.id, watchlistsRateInstrumentIds],
    queryFn: async () => {
      try {
        const { apiKey, userKey } = getEtoroCredentials(activePortfolio);
        return await fetchEtoroRates(apiKey, userKey, watchlistsRateInstrumentIds);
      } catch (err) {
        console.error('[TradingDashboard] Watchlists-Kursabfrage fehlgeschlagen:', err);
        return new Map();
      }
    },
    enabled:
      !!activePortfolio?.id &&
      isEtoro &&
      unlocked &&
      effectiveTab === 'watchlists' &&
      watchlistsRateInstrumentIds.length > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Σ aktueller Wert der lokal gespeicherten eToro-Positionen (USD) für den
  // Abgleich im Übersicht-Tab.
  const localEtoroPositionsValue = useMemo(
    () =>
      (positions ?? [])
        .filter(isEtoroPosition)
        .reduce((sum, p) => sum + p.quantity * (p.last_price || p.entry_price), 0),
    [positions],
  );

  // Allgemeiner News-Feed (News-Tab, Filter "Alle").
  const {
    data: etoroNewsFeed,
    isLoading: isLoadingNewsFeed,
    error: newsFeedError,
    refetch: refetchNewsFeed,
  } = useQuery({
    queryKey: ['etoro-news-feed', activePortfolio?.id],
    queryFn: () => fetchEtoroNewsFeedForPortfolio(activePortfolio),
    enabled: !!activePortfolio?.id && isEtoro && unlocked && effectiveTab === 'news' && newsFilter === 'all',
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Gehaltene eToro-Instrumente für den "Meine Positionen"-Filter — auf die
  // ersten 10 begrenzt (ein Proxy-Aufruf je Instrument teilt sich die
  // Feeds-Rate-Limit-Gruppe; mehr wäre auf einem breit diversifizierten Konto
  // unnötig teuer für einen reinen Lesetab).
  const myPositionsMarketIds = useMemo(() => {
    const ids = (positions ?? [])
      .filter(isEtoroPosition)
      .map((p) => p.metadata?.etoro_instrument_id)
      .filter((id): id is number => typeof id === 'number');
    return [...new Set(ids)].slice(0, 10).map(String);
  }, [positions]);

  const positionsFeedQueries = useQueries({
    queries: myPositionsMarketIds.map((marketId) => ({
      queryKey: ['etoro-market-feed', activePortfolio?.id, marketId],
      queryFn: () => fetchEtoroMarketFeedForPortfolio(activePortfolio, marketId),
      enabled: !!activePortfolio?.id && isEtoro && unlocked && effectiveTab === 'news' && newsFilter === 'my-positions',
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: false,
    })),
  });

  const isLoadingPositionsFeed = positionsFeedQueries.some((q) => q.isLoading);
  const positionsFeedError = positionsFeedQueries.find((q) => q.error)?.error;
  const refetchPositionsFeed = () => positionsFeedQueries.forEach((q) => q.refetch());

  // Refresh quotes mutation
  const refreshQuotesMutation = useMutation({
    mutationFn: async () => {
      if (!positions || positions.length === 0) return;

      // Börsennormalisierte Symbole anfragen (XETRA → .DE usw.) — nur so
      // liefern Yahoo/Stooq für europäische Papiere überhaupt Kurse.
      // eToro-Positionen ausgenommen: deren Symbole kollidieren mit
      // US-Tickern (DASH = DoorDash statt Krypto Dash) und werden über
      // die eToro-instrumentID bepreist, nicht über Yahoo.
      const quotablePositions = positions.filter(p => !isEtoroPosition(p));
      const symbols = quotablePositions.map(p => normalizeSymbol(p.symbol, p.exchange));
      const quotes = symbols.length > 0 ? await fetchQuotesCached(symbols, quoteProvider) : [];

      // Check if mock data was used
      const usingMockData = quotes.some(q => q.name?.includes('Mock'));

      const updates = mapQuotesToPriceUpdates(positions, quotes);
      await batchUpdatePrices(updates);

      return { quotes, updates, usingMockData };
    },
    onSuccess: (result) => {
      if (!result) return;

      const { updates, usingMockData } = result;

      queryClient.invalidateQueries({ queryKey: ['portfolio-positions'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
      setLastUpdate(new Date());

      if (usingMockData) {
        toast(t('trading.dashboard.messages.pricesUpdatedMock').replace('{count}', String(updates.length)), {
          duration: 5000,
        });
      } else if (updates.length === 0) {
        toast(t('trading.dashboard.messages.noQuotesFound'), { duration: 5000 });
      } else {
        toast.success(t('trading.dashboard.messages.pricesUpdated').replace('{count}', String(updates.length)));
      }
    },
    onError: (error: Error) => {
      console.error('[TradingDashboard] Error refreshing quotes:', error);
      toast.error(t('trading.dashboard.messages.pricesUpdateError').replace('{error}', error.message));
    },
  });

  // eToro-Portfolio mit dem Live-Stand abgleichen (persistiert lokal)
  const etoroSyncMutation = useMutation({
    mutationFn: () => syncEtoroPortfolio(activePortfolio!.id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-positions'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
      toast.success(
        t('trading.dashboard.messages.etoroSyncSuccess')
          .replace('{created}', String(result.created))
          .replace('{updated}', String(result.updated))
          .replace('{removed}', String(result.removed))
      );
    },
    onError: (error: Error) => {
      toast.error(t('trading.dashboard.messages.etoroSyncError').replace('{error}', error.message));
    },
  });

  // Auto-refresh quotes every 60 seconds
  useEffect(() => {
    if (!positions || positions.length === 0) return;

    const interval = setInterval(() => {
      if (!refreshQuotesMutation.isPending) {
        refreshQuotesMutation.mutate();
      }
    }, 60000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  // Handle position deletion
  const handleDeletePosition = (id: string) => {
    deletePosition(id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['portfolio-positions'] });
        queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
        toast.success(t('common.deleteSuccess'));
      })
      .catch((error: Error) => {
        toast.error(t('common.deleteError').replace(': ', ': ' + error.message));
      });
  };

  // Handle position editing
  const handleEditPosition = (position: PortfolioPosition) => {
    setEditPosition(position);
    setIsAddPositionDialogOpen(true);
  };

  const handleAddPositionDialogClose = (open: boolean) => {
    setIsAddPositionDialogOpen(open);
    if (!open) {
      setEditPosition(null); // Clear edit position when dialog closes
    }
  };

  // Handle eToro connection success
  const handleEtoroSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['portfolios'] });
    queryClient.invalidateQueries({ queryKey: ['active-portfolio'] });
  };

  // Handle portfolio change
  const handlePortfolioChange = (portfolio: Portfolio) => {
    setActivePortfolio(portfolio);
    queryClient.invalidateQueries({ queryKey: ['portfolio-positions'] });
    queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
  };

  // Handle provider change
  const handleProviderChange = (provider: 'yahoo' | 'stooq') => {
    setQuoteProvider(provider);
  };

  // Generate mock performance data for chart
  const generatePerformanceData = () => {
    if (!summary) return [];
    
    const data = [];
    const days = 30;
    const baseValue = summary.total_cost;
    const currentValue = summary.total_value;
    const step = (currentValue - baseValue) / days;
    
    for (let i = 0; i <= days; i++) {
      const value = baseValue + (step * i) + (Math.random() - 0.5) * (baseValue * 0.02);
      data.push({
        date: i === 0 ? 'Start' : `Tag ${i}`,
        value: Math.max(value, baseValue * 0.8),
      });
    }
    
    return data;
  };

  if (isInitializing || isLoadingPortfolio) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
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
            onClick={() => {
              setEditPosition(null);
              setIsAddPositionDialogOpen(true);
            }}
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

        <TabsContent value="positions" className="space-y-4">
          {isLoadingPositions ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <PositionTable
              positions={positions || []}
              onEdit={handleEditPosition}
              onDelete={handleDeletePosition}
              currency={portfolio?.currency || 'EUR'}
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
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={generatePerformanceData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) => [
                        formatCurrency(value, 'EUR'),
                        t('trading.dashboard.performanceChart.valueLabel')
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
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