/**
 * Depotverwaltung — Liste, Anlegen, Aktivieren, Löschen.
 *
 * Bis WP 6.3 lag der Baustein in `src/components/trading/` und hielt seine
 * Abfrage und drei Mutationen selbst. Beides steht jetzt im ViewModel
 * `features/trading/application/use-trading-portfolios.ts`; hier bleibt die
 * Darstellung und der Dialog-Zustand (Kochrezept Schritt 8).
 */
import { useState } from 'react';
import { useI18n } from '@/i18n/useI18n';
import type { Portfolio } from '@/types';
import { useTradingPortfolios } from '@/features/trading/application/use-trading-portfolios';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, CheckCircle2, Wallet } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LoadingSwap } from '@/components/common/LoadingSwap';
import { Skeleton } from '@/components/ui/skeleton';
import FinanceErrorState from '@/components/common/FinanceErrorState';

interface PortfolioManagerProps {
  activePortfolioId?: string;
  onPortfolioChange?: (portfolio: Portfolio) => void;
}

export default function PortfolioManager({
  activePortfolioId,
  onPortfolioChange,
}: PortfolioManagerProps) {
  const { t } = useI18n();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioCurrency, setNewPortfolioCurrency] = useState('EUR');

  const model = useTradingPortfolios({
    onPortfolioChange,
    onCreated: () => {
      setIsCreateDialogOpen(false);
      setNewPortfolioName('');
    },
  });
  const { portfolios, isLoading } = model;

  const handleCreatePortfolio = () => {
    if (!newPortfolioName.trim()) {
      toast.error(t('trading.portfolioManager.messages.nameRequired'));
      return;
    }
    model.createPortfolio({ name: newPortfolioName.trim(), currency: newPortfolioCurrency });
  };

  const getPortfolioTypeLabel = (type: string) => {
    switch (type) {
      case 'etoro':
        return t('trading.portfolioManager.typeEtoroLabel');
      case 'demo':
        return t('trading.portfolioManager.typeDemoLabel');
      case 'manual':
      default:
        return t('trading.portfolioManager.typeManualLabel');
    }
  };

  const getPortfolioTypeColor = (type: string) => {
    switch (type) {
      case 'etoro':
        return 'default';
      case 'demo':
        return 'secondary';
      case 'manual':
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    // WP-8.3: Choreografie aus WP-7.3 statt eines fruehen Returns mit
    // Ladetext. Der Platzhalter hat die Form der spaeteren Liste; der Text
    // bleibt fuer die Sprachausgabe erhalten.
    return (
      <LoadingSwap
        loading
        skeleton={
          <div className="space-y-3 py-2">
            <Skeleton variant="shimmer" className="h-5 w-40" />
            <Skeleton variant="shimmer" className="h-14 w-full" />
            <Skeleton variant="shimmer" className="h-14 w-full" />
          </div>
        }
      >
        {null}
      </LoadingSwap>
    );
  }

  return (
    <div className="space-y-4">
      {model.hasLoadError && <FinanceErrorState variant="data" onRetry={model.retry} />}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('trading.portfolioManager.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('trading.portfolioManager.subtitle')}
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {t('trading.portfolioManager.newPortfolioButton')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('trading.portfolioManager.createDialogTitle')}</DialogTitle>
              <DialogDescription>
                {t('trading.portfolioManager.createDialogDesc')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="portfolio-name">{t('trading.portfolioManager.nameLabel')}</Label>
                <Input
                  id="portfolio-name"
                  placeholder={t('trading.portfolioManager.namePlaceholder')}
                  value={newPortfolioName}
                  onChange={(e) => setNewPortfolioName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="portfolio-currency">{t('trading.portfolioManager.currencyLabel')}</Label>
                <Input
                  id="portfolio-currency"
                  placeholder={t('trading.portfolioManager.currencyPlaceholder')}
                  value={newPortfolioCurrency}
                  onChange={(e) => setNewPortfolioCurrency(e.target.value.toUpperCase())}
                  maxLength={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                {t('trading.portfolioManager.cancelButton')}
              </Button>
              <Button onClick={handleCreatePortfolio}>
                {t('trading.portfolioManager.createButton')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {portfolios && portfolios.length > 0 ? (
          portfolios.map((portfolio) => (
            <div
              key={portfolio.id}
              className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                portfolio.id === activePortfolioId
                  ? 'bg-primary/5 border-primary/20'
                  : 'hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{portfolio.name}</span>
                    <Badge variant={getPortfolioTypeColor(portfolio.type) as 'default' | 'secondary' | 'outline' | 'destructive'}>
                      {getPortfolioTypeLabel(portfolio.type)}
                    </Badge>
                    {portfolio.id === activePortfolioId && (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {t('trading.portfolioManager.activeBadge')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {portfolio.currency} • {t('trading.portfolioManager.createdAt').replace('{date}', new Date(portfolio.created_at!).toLocaleDateString('de-DE'))}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {portfolio.id !== activePortfolioId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => model.activatePortfolio(portfolio)}
                    disabled={model.isActivating}
                  >
                    {t('trading.portfolioManager.activateButton')}
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      aria-label={t('trading.portfolioManager.deleteLabel').replace('{name}', portfolio.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('trading.portfolioManager.deleteConfirmTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('trading.portfolioManager.deleteConfirmDesc').replace('{name}', portfolio.name)}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('trading.portfolioManager.cancelButton')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => model.deletePortfolio(portfolio.id)}>
                        {t('trading.portfolioManager.deleteButton')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Wallet className="mx-auto h-12 w-12 mb-2 opacity-50" />
            <p>{t('trading.portfolioManager.emptyState')}</p>
            <p className="text-sm">{t('trading.portfolioManager.emptyStateHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
