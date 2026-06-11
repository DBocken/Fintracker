import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Portfolio, PortfolioPosition } from '@/types';
import {
  getActivePortfolio,
  getPositions,
  getPortfolioSummary,
  initializeDemoPortfolio,
  batchUpdatePrices,
  deletePosition,
} from '@/services/portfolio-service';
import { fetchQuotesCached } from '@/services/quote-service';
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

  // Refresh quotes mutation
  const refreshQuotesMutation = useMutation({
    mutationFn: async () => {
      if (!positions || positions.length === 0) return;

      const symbols = positions.map(p => p.symbol);
      console.log('[TradingDashboard] Fetching quotes for symbols:', symbols);
      
      const quotes = await fetchQuotesCached(symbols, quoteProvider);
      
      console.log('[TradingDashboard] Received quotes:', quotes.length);
      console.log('[TradingDashboard] Quotes:', quotes);
      
      // Check if mock data was used
      const usingMockData = quotes.some(q => q.name?.includes('Mock'));
      
      const updates = quotes
        .map(quote => {
          const position = positions.find(p => p.symbol === quote.symbol);
          if (position) {
            console.log(`[TradingDashboard] Match: ${quote.symbol} -> position ${position.id}`);
            return {
              id: position.id,
              price: quote.price,
            };
          }
          console.log(`[TradingDashboard] No match for symbol: ${quote.symbol}`);
          return null;
        })
        .filter((u): u is { id: string; price: number } => u !== null);

      console.log('[TradingDashboard] Updates to apply:', updates.length);
      await batchUpdatePrices(updates);
      
      return { quotes, usingMockData };
    },
    onSuccess: (result) => {
      if (!result) return;
      
      const { quotes, usingMockData } = result;
      
      queryClient.invalidateQueries({ queryKey: ['portfolio-positions'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
      setLastUpdate(new Date());
      
      if (usingMockData) {
        toast(`Kurse aktualisiert (${quotes.length} Positionen) - Simulierte Daten (APIs blockiert)`, {
          duration: 5000,
        });
      } else {
        toast.success(`Kurse aktualisiert (${quotes.length} Positionen)`);
      }
    },
    onError: (error: Error) => {
      console.error('[TradingDashboard] Error refreshing quotes:', error);
      toast.error(`Fehler beim Aktualisieren der Kurse: ${error.message}`);
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
  }, [positions]);

  // Handle position deletion
  const handleDeletePosition = (id: string) => {
    deletePosition(id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['portfolio-positions'] });
        queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
        toast.success('Position gelöscht');
      })
      .catch((error: Error) => {
        toast.error(`Fehler beim Löschen: ${error.message}`);
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
          <strong>🔒 Privatsphäre-Modus aktiv:</strong> Ihre Portfolio-Daten werden ausschließlich lokal
          gespeichert. Ihr Backend hat keinen Zugriff auf Ihre Finanzdaten.
          {positions && positions.length > 0 && (
            <>
              <br />
              <span className="text-xs text-muted-foreground">
                💡 Preise können über den Bleistift-Icon manuell bearbeitet werden
              </span>
            </>
          )}
        </AlertDescription>
      </Alert>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Trading Portfolio</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Investitionen und verfolgen Sie die Performance
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
            Kurse aktualisieren
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditPosition(null);
              setIsAddPositionDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Position hinzufügen
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOcrImportDialogOpen(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Bild importieren
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast('CSV-Import wird in Kürze verfügbar sein')}
            title="In Kürze verfügbar"
          >
            <FileText className="h-4 w-4 mr-2" />
            CSV Importieren
          </Button>
          <Button
            size="sm"
            onClick={() => setIsEtoroDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            eToro verbinden
          </Button>
        </div>
      </div>

      {/* Live Update Status */}
      {lastUpdate && (
        <Alert>
          <Activity className="h-4 w-4" />
          <AlertDescription>
            Zuletzt aktualisiert: {lastUpdate.toLocaleTimeString('de-DE')} •
            Datenquelle: <Badge variant="outline" className="ml-1">{quoteProvider.toUpperCase()}</Badge>
          </AlertDescription>
        </Alert>
      )}

      {/* Portfolio Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gesamtwert</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.total_value, summary.currency)}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.positions_count} Positionen
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Investiert</CardTitle>
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
              <CardTitle className="text-sm font-medium">Gewinn/Verlust</CardTitle>
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
              <CardTitle className="text-sm font-medium">Rendite</CardTitle>
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
                Aktuell unrealisiert
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="positions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="positions">Positionen</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="portfolios">Portfolios verwalten</TabsTrigger>
        </TabsList>

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
          <Card>
            <CardHeader>
              <CardTitle>Portfolio-Verlauf</CardTitle>
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
                      'Wert'
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
                * Simulierter Verlauf basierend auf aktuellen Portfoliodaten
              </p>
            </CardContent>
          </Card>
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