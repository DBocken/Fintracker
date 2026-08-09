/**
 * ViewModel des Depot-Kerns im Trading-Bereich.
 *
 * Depot, Positionen, Kennzahlen, Kursaktualisierung und die Mutationen dazu.
 * Stand zuvor gemeinsam mit den zwanzig eToro-Abfragen und 430 Zeilen JSX in
 * `TradingDashboard.tsx`.
 *
 * Die eToro-Bereiche liegen daneben in `use-etoro-account.ts`. Getrennt, weil
 * es zwei verschiedene Dinge sind: Der Depot-Kern gilt für JEDES Depot und
 * liest lokal; die eToro-Abfragen betreffen nur eToro-Konten, gehen ins Netz
 * und stehen unter einem Rate-Limit.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
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
import { getPreferredMarketProvider } from '@/services/user-settings-service';

export function useTradingPortfolio() {
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
  const {
    data: hasInitialized,
    isLoading: isInitializing,
    isError: initializationError,
    refetch: refetchInitialization,
  } = useQuery({
    queryKey: ['portfolio-initialization'],
    queryFn: async () => {
      const portfolio = await initializeDemoPortfolio();
      return portfolio;
    },
    staleTime: Infinity,
  });

  // Get active portfolio
  const {
    data: portfolio,
    isLoading: isLoadingPortfolio,
    isError: portfolioError,
    refetch: refetchPortfolio,
  } = useQuery({
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
  const {
    data: positions,
    isLoading: isLoadingPositions,
    isError: positionsError,
    refetch: refetchPositions,
  } = useQuery({
    queryKey: ['portfolio-positions', activePortfolio?.id],
    queryFn: () => getPositions(activePortfolio!.id),
    enabled: !!activePortfolio?.id,
  });

  // Get portfolio summary
  const {
    data: summary,
    isError: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['portfolio-summary', activePortfolio?.id],
    queryFn: () => getPortfolioSummary(activePortfolio!.id),
    enabled: !!activePortfolio?.id,
  });

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
  // `refreshQuotesMutation` bewusst nicht in den Deps: Es ist ein react-query-
  // Mutations-Objekt mit stabiler `mutate`-Funktion — sein Einschluss würde
  // das 60-Sekunden-Intervall bei jedem Render neu aufsetzen statt laufen zu lassen.
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

  /** Neue Position anlegen: eine etwaige Bearbeitung zuerst verwerfen. */
  const startAddPosition = () => {
    setEditPosition(null);
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

  // WP-9.6: Depot, Positionen und Kennzahlen sind Bestandsdaten. Faellt ihr
  // Lesevorgang aus, zeigt der Fallback ein LEERES Depot — „du besitzt nichts"
  // ist hier die teuerste Falschaussage der App. Eine Aussage fuer alle vier
  // Abfragen: Sie haben dieselbe Quelle, vier Meldungen waeren vier Raetsel.
  //
  // Die eToro-Zusatzabfragen weiter unten stehen bewusst NICHT hier: Ihre
  // `queryFn` faengt den Fehler selbst ab und liefert eine dokumentierte
  // Ersatzantwort (leere Map, Anzeige faellt auf „Instrument #<id>" zurueck).
  // Sie koennen den Fehlerzustand gar nicht erreichen.
  const hasLoadError = initializationError || portfolioError || positionsError || summaryError;
  const retryAll = () => {
    void refetchInitialization();
    void refetchPortfolio();
    void refetchPositions();
    void refetchSummary();
  };


  return {
    // Depot
    activePortfolio,
    positions,
    summary,
    isInitializing,
    isLoadingPortfolio,
    isLoadingPositions,
    hasLoadError,
    retryAll,

    // Kursanbieter
    quoteProvider,
    preferredProvider,
    handleProviderChange,

    // Kursaktualisierung
    refreshQuotesMutation,
    lastUpdate,

    // eToro-Abgleich
    etoroSyncMutation,

    // Dialoge
    isEtoroDialogOpen,
    setIsEtoroDialogOpen,
    isAddPositionDialogOpen,
    handleAddPositionDialogClose,
    isOcrImportDialogOpen,
    setIsOcrImportDialogOpen,
    editPosition,

    // Aktionen
    handleDeletePosition,
    handleEditPosition,
    handleEtoroSuccess,
    handlePortfolioChange,
    startAddPosition,
  };
}
