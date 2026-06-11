import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Portfolio } from '@/types';
import {
  getPortfolios,
  deletePortfolio,
  setActivePortfolio,
  createPortfolio,
} from '@/services/portfolio-service';
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

interface PortfolioManagerProps {
  activePortfolioId?: string;
  onPortfolioChange?: (portfolio: Portfolio) => void;
}

export default function PortfolioManager({
  activePortfolioId,
  onPortfolioChange,
}: PortfolioManagerProps) {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioCurrency, setNewPortfolioCurrency] = useState('EUR');

  const { data: portfolios, isLoading } = useQuery({
    queryKey: ['portfolios'],
    queryFn: getPortfolios,
  });

  const deleteMutation = useMutation({
    mutationFn: deletePortfolio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      toast.success('Portfolio gelöscht');
    },
    onError: (error: Error) => {
      toast.error(`Fehler beim Löschen: ${error.message}`);
    },
  });

  const setActiveMutation = useMutation({
    mutationFn: setActivePortfolio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      toast.success('Portfolio aktiviert');
    },
    onError: (error: Error) => {
      toast.error(`Fehler beim Aktivieren: ${error.message}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: createPortfolio,
    onSuccess: (portfolio) => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      setIsCreateDialogOpen(false);
      setNewPortfolioName('');
      toast.success('Portfolio erstellt');
      onPortfolioChange?.(portfolio);
    },
    onError: (error: Error) => {
      toast.error(`Fehler beim Erstellen: ${error.message}`);
    },
  });

  const handleCreatePortfolio = () => {
    if (!newPortfolioName.trim()) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }
    createMutation.mutate({
      name: newPortfolioName.trim(),
      type: 'manual',
      currency: newPortfolioCurrency,
      is_active: false,
    });
  };

  const handleSetActive = (portfolio: Portfolio) => {
    setActiveMutation.mutate(portfolio.id);
    onPortfolioChange?.(portfolio);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const getPortfolioTypeLabel = (type: string) => {
    switch (type) {
      case 'etoro':
        return 'eToro';
      case 'demo':
        return 'Demo';
      case 'manual':
      default:
        return 'Manuell';
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
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">Laden...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Portfolios</h3>
          <p className="text-sm text-muted-foreground">
            Verwalten Sie Ihre Portfolios
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Neues Portfolio
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Neues Portfolio erstellen</DialogTitle>
              <DialogDescription>
                Erstellen Sie ein neues Portfolio für Ihre Investitionen.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="portfolio-name">Name</Label>
                <Input
                  id="portfolio-name"
                  placeholder="Mein Portfolio"
                  value={newPortfolioName}
                  onChange={(e) => setNewPortfolioName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="portfolio-currency">Währung</Label>
                <Input
                  id="portfolio-currency"
                  placeholder="EUR"
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
                Abbrechen
              </Button>
              <Button onClick={handleCreatePortfolio}>
                Erstellen
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
                    <Badge variant={getPortfolioTypeColor(portfolio.type) as any}>
                      {getPortfolioTypeLabel(portfolio.type)}
                    </Badge>
                    {portfolio.id === activePortfolioId && (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Aktiv
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {portfolio.currency} • Erstellt am {new Date(portfolio.created_at!).toLocaleDateString('de-DE')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {portfolio.id !== activePortfolioId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetActive(portfolio)}
                    disabled={setActiveMutation.isPending}
                  >
                    Aktivieren
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Portfolio löschen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Möchten Sie das Portfolio "{portfolio.name}" wirklich löschen?
                        Alle Positionen in diesem Portfolio werden ebenfalls gelöscht.
                        Diese Aktion kann nicht rückgängig gemacht werden.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(portfolio.id)}>
                        Löschen
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
            <p>Keine Portfolios vorhanden</p>
            <p className="text-sm">Erstellen Sie Ihr erstes Portfolio</p>
          </div>
        )}
      </div>
    </div>
  );
}
