/**
 * ViewModel der eToro-Bereiche im Trading-Depot.
 *
 * Zwanzig Abfragen, verteilt auf sieben Tabs. Sie standen zuvor alle in
 * `TradingDashboard.tsx` — zusammen mit fünf weiteren Abfragen des
 * Depot-Kerns, fünf Mutationen und 430 Zeilen JSX. Damit war keine einzige
 * dieser Ladebedingungen prüfbar, ohne den ganzen Screen zu rendern.
 *
 * Jede Abfrage teilt dasselbe Gatter: ein Portfolio muss gewählt, es muss ein
 * eToro-Konto sein, die lokale Verschlüsselung entsperrt und der zugehörige
 * Tab aktiv. Das ist Absicht und kein Zufall — eToro begrenzt die Aufrufe pro
 * Zeitfenster, und ein Tab, den niemand ansieht, darf dieses Budget nicht
 * verbrauchen. Formuliert ist die Bedingung in `useEtoroTabQuery`, damit sie
 * an einer Stelle steht statt an zwanzig.
 *
 * Die Rückgabe ist bewusst flach und trägt dieselben Namen wie zuvor die
 * lokalen Konstanten: so bleibt der Umbau im Diff als Verschiebung lesbar und
 * nicht als Umschreiben der Darstellung. Eine Gruppierung nach Tabs wäre der
 * nächste Schritt, nicht dieser.
 */
import { useEffect, useMemo, useState } from 'react';
import { currentPriceOf } from '@/features/trading/domain/position-metrics';
import { useQuery, useQueries } from '@tanstack/react-query';
import { firstQueryError } from '@/lib/query-results';
import type { Portfolio, PortfolioPosition } from '@/types';
import { useLocalEncryption } from '@/hooks/useLocalEncryption';
import { isEtoroPosition } from '@/services/quote-service';
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
  fetchEtoroDemoPnlForPortfolio,
  fetchEtoroInstrumentSearchForPortfolio,
  fetchEtoroCuratedListsForPortfolio,
  fetchEtoroInstrumentCandlesForPortfolio,
  fetchEtoroPublicUserInfoForPortfolio,
} from '@/services/etoro-account-service';
import { getEtoroCredentials, fetchEtoroInstrumentMeta, fetchEtoroStocksIndustries, fetchEtoroRates } from '@/services/etoro-service';
import { selectEtoroMirrors } from '@/services/etoro-mirrors';
import { selectCashAccountId, selectPerformanceSeries } from '@/services/etoro-performance';
import { selectWatchlistSummaries, selectWatchlistItems } from '@/services/etoro-watchlists';
import type {
  EtoroNewsFilter,
  EtoroDiscoverInstrumentOption,
} from '@/features/trading/domain/etoro-view-state';
import {
  ETORO_QUERY_DEFAULTS,
  ETORO_STALE_LIVE,
  ETORO_STALE_META,
  etoroTabEnabled,
} from './etoro-tab-gate';

export interface UseEtoroAccountInput {
  portfolio: Portfolio | null;
  positions: PortfolioPosition[] | undefined;
}

export function useEtoroAccount({ portfolio, positions }: UseEtoroAccountInput) {
  // eToro-spezifische Tabs & Live-Konto-Snapshot
  const { unlocked } = useLocalEncryption();
  const isEtoro = portfolio?.type === 'etoro';

  // Kontrollierter Tab-State: null = Standard je Portfolio-Typ (eToro →
  // Übersicht, sonst Positionen). Bei Portfolio-Wechsel zurücksetzen.
  const [activeTab, setActiveTab] = useState<string | null>(null);
  useEffect(() => {
    setActiveTab(null);
  }, [portfolio?.id]);
  const effectiveTab = activeTab ?? (isEtoro ? 'overview' : 'positions');

  // Ein Gatter, zwanzigmal benutzt — siehe `etoro-tab-gate.ts`.
  const gate = { portfolio, isEtoro, unlocked, effectiveTab };

  // Ausgewählte Watchlist im Watchlists-Tab — null = Standard (isDefault/erste
  // Watchlist). Bei Portfolio-Wechsel zurücksetzen wie activeTab.
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null);
  useEffect(() => {
    setSelectedWatchlistId(null);
  }, [portfolio?.id]);

  // Filter im News-Tab ("Alle" vs. "Meine Positionen"). Bei Portfolio-Wechsel
  // zurücksetzen wie activeTab.
  const [newsFilter, setNewsFilter] = useState<EtoroNewsFilter>('all');
  useEffect(() => {
    setNewsFilter('all');
  }, [portfolio?.id]);

  // Discover-Tab: Instrument-/Trader-Suche sind nutzer-getriggert — das
  // Eingabefeld (Input-State) ist getrennt von der zuletzt abgeschickten
  // Suche (Query-State, treibt Query-Key + `enabled`), damit Tippen allein
  // keinen Fetch auslöst. Bei Portfolio-Wechsel alles zurücksetzen wie
  // activeTab.
  const [discoverSearchInput, setDiscoverSearchInput] = useState('');
  const [discoverSearchQuery, setDiscoverSearchQuery] = useState('');
  const [discoverUsernameInput, setDiscoverUsernameInput] = useState('');
  const [discoverUsername, setDiscoverUsername] = useState('');
  const [discoverSelectedInstrument, setDiscoverSelectedInstrument] = useState<EtoroDiscoverInstrumentOption | undefined>(
    undefined,
  );
  useEffect(() => {
    setDiscoverSearchInput('');
    setDiscoverSearchQuery('');
    setDiscoverUsernameInput('');
    setDiscoverUsername('');
    setDiscoverSelectedInstrument(undefined);
  }, [portfolio?.id]);

  // Konto-Snapshot (Cash, Totals, Mirrors) — Live-View, nur bei aktivem
  // Übersicht-Tab und entsperrter Verschlüsselung. staleTime 60 s wegen des
  // geteilten Portfolio-Gruppen-Rate-Limits (60 req/60 s).
  const {
    data: etoroAggregate,
    isLoading: isLoadingAggregate,
    error: aggregateError,
    refetch: refetchAggregate,
  } = useQuery({
    queryKey: ['etoro-aggregate', portfolio?.id],
    queryFn: () => fetchEtoroAggregateForPortfolio(portfolio),
    enabled: etoroTabEnabled(gate, ['overview', 'mirrors', 'analysis']),
    staleTime: ETORO_STALE_LIVE,
    ...ETORO_QUERY_DEFAULTS,
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
    queryKey: ['etoro-mirror-instruments', portfolio?.id],
    queryFn: async () => {
      try {
        const { apiKey, userKey } = getEtoroCredentials(portfolio);
        return await fetchEtoroInstrumentMeta(apiKey, userKey, mirrorInstrumentIds);
      } catch (err) {
        console.error('[TradingDashboard] Mirror-Instrument-Auflösung fehlgeschlagen:', err);
        return new Map();
      }
    },
    enabled: etoroTabEnabled(gate, 'mirrors') && mirrorInstrumentIds.length > 0,
    staleTime: ETORO_STALE_META,
    ...ETORO_QUERY_DEFAULTS,
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
    queryKey: ['etoro-trade-history', portfolio?.id],
    queryFn: () => fetchEtoroTradeHistoryForPortfolio(portfolio),
    enabled: etoroTabEnabled(gate, 'history'),
    staleTime: ETORO_STALE_META,
    ...ETORO_QUERY_DEFAULTS,
  });

  // Konto-P&L (Historie-Tab) — teilt sich die Portfolio-Gruppe (60 req/60 s)
  // mit aggregate-portfolio/portfolio, daher dieselbe staleTime.
  const {
    data: etoroPnl,
    isLoading: isLoadingPnl,
    error: pnlError,
    refetch: refetchPnl,
  } = useQuery({
    queryKey: ['etoro-pnl', portfolio?.id],
    queryFn: () => fetchEtoroPnlForPortfolio(portfolio),
    enabled: etoroTabEnabled(gate, 'history'),
    staleTime: ETORO_STALE_LIVE,
    ...ETORO_QUERY_DEFAULTS,
  });

  // Instrument-Symbole/-Namen für die Trade-Zeilen im Historie-Tab — analog
  // mirrorInstrumentMeta oben (eigene Query, Fehler defensiv auf leere Map).
  const tradeHistoryInstrumentIds = useMemo(
    () => (etoroTradeHistory ?? []).map((trade) => trade.instrumentId),
    [etoroTradeHistory],
  );

  const { data: tradeHistoryInstrumentMeta } = useQuery({
    queryKey: ['etoro-trade-history-instruments', portfolio?.id],
    queryFn: async () => {
      try {
        const { apiKey, userKey } = getEtoroCredentials(portfolio);
        return await fetchEtoroInstrumentMeta(apiKey, userKey, tradeHistoryInstrumentIds);
      } catch (err) {
        console.error('[TradingDashboard] Trade-History-Instrument-Auflösung fehlgeschlagen:', err);
        return new Map();
      }
    },
    enabled: etoroTabEnabled(gate, 'history') && tradeHistoryInstrumentIds.length > 0,
    staleTime: ETORO_STALE_META,
    ...ETORO_QUERY_DEFAULTS,
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
    queryKey: ['etoro-balances', portfolio?.id],
    queryFn: () => fetchEtoroBalancesForPortfolio(portfolio),
    enabled: etoroTabEnabled(gate, 'history'),
    staleTime: ETORO_STALE_LIVE,
    ...ETORO_QUERY_DEFAULTS,
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
    queryKey: ['etoro-cash-transactions', portfolio?.id, cashAccountId],
    queryFn: () => fetchEtoroCashTransactionsForPortfolio(portfolio, cashAccountId!),
    enabled: etoroTabEnabled(gate, 'history') && !!cashAccountId,
    staleTime: ETORO_STALE_META,
    ...ETORO_QUERY_DEFAULTS,
  });

  // Tägliche Kontostand-Snapshots (Performance-Tab) — ersetzt den bisherigen
  // synthetischen Mock. eToro-Default (letzte 30 Tage) wird nicht überschrieben.
  const {
    data: etoroBalancesHistory,
    isLoading: isLoadingBalancesHistory,
    error: balancesHistoryError,
    refetch: refetchBalancesHistory,
  } = useQuery({
    queryKey: ['etoro-balances-history', portfolio?.id],
    queryFn: () => fetchEtoroBalancesHistoryForPortfolio(portfolio),
    enabled: etoroTabEnabled(gate, 'performance'),
    staleTime: ETORO_STALE_META,
    ...ETORO_QUERY_DEFAULTS,
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
    queryKey: ['etoro-analysis-instruments', portfolio?.id],
    queryFn: async () => {
      try {
        const { apiKey, userKey } = getEtoroCredentials(portfolio);
        return await fetchEtoroInstrumentMeta(apiKey, userKey, analysisInstrumentIds);
      } catch (err) {
        console.error('[TradingDashboard] Analyse-Instrument-Auflösung fehlgeschlagen:', err);
        return new Map();
      }
    },
    enabled: etoroTabEnabled(gate, 'analysis') && analysisInstrumentIds.length > 0,
    staleTime: ETORO_STALE_META,
    ...ETORO_QUERY_DEFAULTS,
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
    queryKey: ['etoro-stocks-industries', portfolio?.id, analysisIndustryIds],
    queryFn: async () => {
      try {
        const { apiKey, userKey } = getEtoroCredentials(portfolio);
        return await fetchEtoroStocksIndustries(apiKey, userKey, analysisIndustryIds);
      } catch (err) {
        console.error('[TradingDashboard] Branchen-Auflösung fehlgeschlagen:', err);
        return new Map();
      }
    },
    enabled: etoroTabEnabled(gate, 'analysis') && analysisIndustryIds.length > 0,
    staleTime: ETORO_STALE_META,
    ...ETORO_QUERY_DEFAULTS,
  });

  // Liste aller Watchlists (Namen/Metadaten, Watchlists-Tab) — teilt sich eine
  // Rate-Limit-Gruppe mit der Einzelabfrage unten.
  const {
    data: etoroWatchlists,
    isLoading: isLoadingWatchlists,
    error: watchlistsError,
    refetch: refetchWatchlists,
  } = useQuery({
    queryKey: ['etoro-watchlists', portfolio?.id],
    queryFn: () => fetchEtoroWatchlistsForPortfolio(portfolio),
    enabled: etoroTabEnabled(gate, 'watchlists'),
    staleTime: ETORO_STALE_LIVE,
    ...ETORO_QUERY_DEFAULTS,
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
    queryKey: ['etoro-watchlist-items', portfolio?.id, effectiveWatchlistId],
    queryFn: () => fetchEtoroWatchlistItemsForPortfolio(portfolio, effectiveWatchlistId!),
    enabled: etoroTabEnabled(gate, 'watchlists') && !!effectiveWatchlistId,
    staleTime: ETORO_STALE_LIVE,
    ...ETORO_QUERY_DEFAULTS,
  });

  // Aktive Kursalarme (Watchlists-Tab) — eigener "Default"-Rate-Limit-Pool.
  const {
    data: etoroPriceAlerts,
    isLoading: isLoadingPriceAlerts,
    error: priceAlertsError,
    refetch: refetchPriceAlerts,
  } = useQuery({
    queryKey: ['etoro-price-alerts', portfolio?.id],
    queryFn: () => fetchEtoroPriceAlertsForPortfolio(portfolio),
    enabled: etoroTabEnabled(gate, 'watchlists'),
    staleTime: ETORO_STALE_LIVE,
    ...ETORO_QUERY_DEFAULTS,
  });

  // Live-Kurse für Watchlist-Items + Kursalarm-Instrumente — über den
  // bestehenden fetchEtoroRates (kollisionsfrei ggü. Yahoo-Tickern).
  const watchlistsRateInstrumentIds = useMemo(() => {
    const fromItems = selectWatchlistItems(etoroWatchlistItems, new Map()).map((item) => item.itemId);
    const fromAlerts = (etoroPriceAlerts?.results ?? []).map((alert) => alert.instrumentId);
    return [...new Set([...fromItems, ...fromAlerts])];
  }, [etoroWatchlistItems, etoroPriceAlerts]);

  const { data: watchlistsRates } = useQuery({
    queryKey: ['etoro-watchlists-rates', portfolio?.id, watchlistsRateInstrumentIds],
    queryFn: async () => {
      try {
        const { apiKey, userKey } = getEtoroCredentials(portfolio);
        return await fetchEtoroRates(apiKey, userKey, watchlistsRateInstrumentIds);
      } catch (err) {
        console.error('[TradingDashboard] Watchlists-Kursabfrage fehlgeschlagen:', err);
        return new Map();
      }
    },
    enabled: etoroTabEnabled(gate, 'watchlists') && watchlistsRateInstrumentIds.length > 0,
    staleTime: ETORO_STALE_LIVE,
    ...ETORO_QUERY_DEFAULTS,
  });

  // Σ aktueller Wert der lokal gespeicherten eToro-Positionen (USD) für den
  // Abgleich im Übersicht-Tab.
  const localEtoroPositionsValue = useMemo(
    () =>
      (positions ?? [])
        .filter(isEtoroPosition)
        .reduce((sum, p) => sum + p.quantity * currentPriceOf(p), 0),
    [positions],
  );

  // Allgemeiner News-Feed (News-Tab, Filter "Alle").
  const {
    data: etoroNewsFeed,
    isLoading: isLoadingNewsFeed,
    error: newsFeedError,
    refetch: refetchNewsFeed,
  } = useQuery({
    queryKey: ['etoro-news-feed', portfolio?.id],
    queryFn: () => fetchEtoroNewsFeedForPortfolio(portfolio),
    enabled: etoroTabEnabled(gate, 'news') && newsFilter === 'all',
    staleTime: ETORO_STALE_LIVE,
    ...ETORO_QUERY_DEFAULTS,
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
      queryKey: ['etoro-market-feed', portfolio?.id, marketId],
      queryFn: () => fetchEtoroMarketFeedForPortfolio(portfolio, marketId),
      enabled: etoroTabEnabled(gate, 'news') && newsFilter === 'my-positions',
      staleTime: ETORO_STALE_LIVE,
      ...ETORO_QUERY_DEFAULTS,
    })),
  });

  const isLoadingPositionsFeed = positionsFeedQueries.some((q) => q.isLoading);
  // `.find(...)?.error` liefert bei keinem Treffer `undefined`, nicht `null` —
  // `firstQueryError` normalisiert das auf denselben `Error | null`, den jede
  // andere Abfrage hier schon von `useQuery` bekommt (siehe query-results.ts).
  const positionsFeedError = firstQueryError(positionsFeedQueries);
  const refetchPositionsFeed = () => positionsFeedQueries.forEach((q) => q.refetch());

  // Demo-Konto-P&L (kleiner Zusatzblock im Übersicht-Tab) — teilt sich denselben
  // Response-Shape wie das reale Konto-pnl (siehe EtoroPnlResponseSchema).
  // Kein Demo-Konto zu haben ist der Normalfall, daher degradiert die Karte
  // selbst still bei Fehler/leerer Antwort (siehe EtoroDemoAccountCard).
  const {
    data: etoroDemoPnl,
    isLoading: isLoadingDemoPnl,
    error: demoPnlError,
  } = useQuery({
    queryKey: ['etoro-demo-pnl', portfolio?.id],
    queryFn: () => fetchEtoroDemoPnlForPortfolio(portfolio),
    enabled: etoroTabEnabled(gate, 'overview'),
    staleTime: ETORO_STALE_LIVE,
    ...ETORO_QUERY_DEFAULTS,
  });

  // Instrument-Suche (Discover-Tab) — nutzer-getriggert: `enabled` erst nach
  // Absenden des Suchformulars (discoverSearchQuery), nicht bei jedem Tastenanschlag.
  const {
    data: etoroInstrumentSearch,
    isLoading: isLoadingInstrumentSearch,
    error: instrumentSearchError,
    refetch: refetchInstrumentSearch,
  } = useQuery({
    queryKey: ['etoro-instrument-search', portfolio?.id, discoverSearchQuery],
    queryFn: () => fetchEtoroInstrumentSearchForPortfolio(portfolio, discoverSearchQuery),
    enabled: etoroTabEnabled(gate, 'discover') && discoverSearchQuery.length > 0,
    staleTime: ETORO_STALE_LIVE,
    ...ETORO_QUERY_DEFAULTS,
  });

  // Kuratierte Listen (Discover-Tab) — tab-gated, kein Nutzer-Trigger nötig.
  const {
    data: etoroCuratedLists,
    isLoading: isLoadingCuratedLists,
    error: curatedListsError,
    refetch: refetchCuratedLists,
  } = useQuery({
    queryKey: ['etoro-curated-lists', portfolio?.id],
    queryFn: () => fetchEtoroCuratedListsForPortfolio(portfolio),
    enabled: etoroTabEnabled(gate, 'discover'),
    staleTime: ETORO_STALE_META,
    ...ETORO_QUERY_DEFAULTS,
  });

  // Candles des im Discover-Tab ausgewählten Instruments (Suche oder kuratierte Liste).
  const {
    data: etoroInstrumentCandles,
    isLoading: isLoadingCandles,
    error: candlesError,
    refetch: refetchCandles,
  } = useQuery({
    queryKey: ['etoro-instrument-candles', portfolio?.id, discoverSelectedInstrument?.instrumentId],
    queryFn: () => fetchEtoroInstrumentCandlesForPortfolio(portfolio, discoverSelectedInstrument!.instrumentId),
    enabled: etoroTabEnabled(gate, 'discover') && !!discoverSelectedInstrument,
    staleTime: ETORO_STALE_LIVE,
    ...ETORO_QUERY_DEFAULTS,
  });

  // Öffentliches Trader-Profil (Discover-Tab) — nutzer-getriggert wie die Instrument-Suche.
  const {
    data: etoroPublicUserInfo,
    isLoading: isLoadingPublicUserInfo,
    error: publicUserInfoError,
    refetch: refetchPublicUserInfo,
  } = useQuery({
    queryKey: ['etoro-user-info', portfolio?.id, discoverUsername],
    queryFn: () => fetchEtoroPublicUserInfoForPortfolio(portfolio, discoverUsername),
    enabled: etoroTabEnabled(gate, 'discover') && discoverUsername.length > 0,
    staleTime: ETORO_STALE_LIVE,
    ...ETORO_QUERY_DEFAULTS,
  });

  return {
    isEtoro,
    unlocked,

    // Tab-Steuerung
    activeTab,
    setActiveTab,
    effectiveTab,

    // Übersicht
    etoroAggregate,
    isLoadingAggregate,
    aggregateError,
    refetchAggregate,
    localEtoroPositionsValue,
    etoroDemoPnl,
    isLoadingDemoPnl,
    demoPnlError,

    // Smart Portfolios
    mirrorInstrumentMeta,

    // Historie
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

    // Performance
    isLoadingBalancesHistory,
    balancesHistoryError,
    refetchBalancesHistory,
    performanceSeries,

    // Analyse
    analysisInstrumentMeta,
    analysisInstrumentIndustryMap,
    analysisIndustryNameMap,

    // Watchlists
    etoroWatchlists,
    isLoadingWatchlists,
    watchlistsError,
    refetchWatchlists,
    watchlistSummaries,
    selectedWatchlistId,
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

    // News
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

    // Entdecken
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
  };
}
