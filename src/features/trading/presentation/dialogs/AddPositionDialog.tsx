import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n/useI18n';
import type { PortfolioPosition } from '@/types';
import { createPosition, updatePosition } from '@/services/portfolio-service';
import { fetchQuote, normalizeSymbol } from '@/services/quote-service';
import { getPreferredMarketProvider } from '@/services/user-settings-service';
import { formatCurrency } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/features/shared/presentation/DecimalInput';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import { Loader2, Search } from 'lucide-react';

interface AddPositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId: string;
  editPosition?: PortfolioPosition | null; // New prop for editing
}

export default function AddPositionDialog({
  open,
  onOpenChange,
  portfolioId,
  editPosition,
}: AddPositionDialogProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState<number | null>(null);
  const [entryPrice, setEntryPrice] = useState<number | null>(null);
  const [currency, setCurrency] = useState('EUR');
  const [exchange, setExchange] = useState('');
  const [buyDate, setBuyDate] = useState('');
  const [quoteCheck, setQuoteCheck] = useState<
    | { status: 'idle' }
    | { status: 'checking' }
    | { status: 'found'; price: number; currency?: string }
    | { status: 'not-found' }
    | { status: 'error'; message: string }
  >({ status: 'idle' });

  const isEditing = !!editPosition;

  // Populate form when editing
  useEffect(() => {
    if (editPosition) {
      setSymbol(editPosition.symbol);
      setName(editPosition.name || '');
      setQuantity(editPosition.quantity);
      setEntryPrice(editPosition.entry_price);
      setCurrency(editPosition.currency || 'EUR');
      setExchange(editPosition.exchange || '');
      setBuyDate((editPosition.metadata?.buy_date as string | undefined) || '');
    } else {
      // Reset form for new position
      setSymbol('');
      setName('');
      setQuantity(null);
      setEntryPrice(null);
      setCurrency('EUR');
      setExchange('');
      setBuyDate('');
    }
    setQuoteCheck({ status: 'idle' });
  }, [editPosition, open]);

  const handleTestQuote = async () => {
    const trimmedSymbol = symbol.trim();
    if (!trimmedSymbol) return;

    setQuoteCheck({ status: 'checking' });
    try {
      const provider = await getPreferredMarketProvider();
      const quote = await fetchQuote(normalizeSymbol(trimmedSymbol, exchange), provider);
      if (quote) {
        setQuoteCheck({ status: 'found', price: quote.price, currency: quote.currency });
      } else {
        setQuoteCheck({ status: 'not-found' });
      }
    } catch (error) {
      setQuoteCheck({ status: 'error', message: (error as Error).message });
    }
  };

  const createMutation = useMutation({
    mutationFn: async (position: Partial<PortfolioPosition>) => {
      return await createPosition(position);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-positions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary', portfolioId] });
      toast.success(t('trading.addPositionDialog.messages.success'));
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(t('trading.addPositionDialog.messages.errorAdd').replace('{error}', error.message));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (position: { id: string; updates: Partial<PortfolioPosition> }) => {
      return await updatePosition(position.id, position.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-positions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary', portfolioId] });
      toast.success(t('trading.addPositionDialog.messages.updateSuccess'));
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(t('trading.addPositionDialog.messages.errorUpdate').replace('{error}', error.message));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!symbol.trim()) {
      toast.error(t('trading.addPositionDialog.messages.symbolRequired'));
      return;
    }

    // Validate symbol format (A-Z, 0-9, dot, hyphen)
    const symbolRegex = /^[A-Z0-9.-]+$/;
    if (!symbolRegex.test(symbol.trim().toUpperCase())) {
      toast.error(t('trading.addPositionDialog.messages.invalidSymbol'));
      return;
    }

    const quantityNum = quantity ?? NaN;
    if (isNaN(quantityNum) || quantityNum <= 0) {
      toast.error(t('trading.addPositionDialog.messages.quantityInvalid'));
      return;
    }

    const entryPriceNum = entryPrice ?? NaN;
    if (isNaN(entryPriceNum) || entryPriceNum < 0) {
      toast.error(t('trading.addPositionDialog.messages.priceInvalid'));
      return;
    }

    if (isEditing && editPosition) {
      // Update existing position
      updateMutation.mutate({
        id: editPosition.id,
        updates: {
          symbol: symbol.trim().toUpperCase(),
          name: name.trim() || symbol.trim().toUpperCase(),
          quantity: quantityNum,
          entry_price: entryPriceNum,
          currency: currency,
          exchange: exchange || undefined,
          metadata: buyDate ? { buy_date: buyDate } : undefined,
        },
      });
    } else {
      // Create new position
      createMutation.mutate({
        portfolio_id: portfolioId,
        symbol: symbol.trim().toUpperCase(),
        name: name.trim() || symbol.trim().toUpperCase(),
        quantity: quantityNum,
        entry_price: entryPriceNum,
        currency: currency,
        exchange: exchange || undefined,
        metadata: buyDate ? { buy_date: buyDate } : undefined,
      });
    }
  };

  const handleClose = () => {
    // Reset form
    setSymbol('');
    setName('');
    setQuantity(null);
    setEntryPrice(null);
    setCurrency('EUR');
    setExchange('');
    setBuyDate('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('trading.addPositionDialog.titleEdit') : t('trading.addPositionDialog.titleNew')}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t('trading.addPositionDialog.descEdit')
              : t('trading.addPositionDialog.descNew')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="symbol" className="text-right">
                {t('trading.addPositionDialog.symbolLabel')}
              </Label>
              <Input
                id="symbol"
                placeholder={t('trading.addPositionDialog.symbolPlaceholder')}
                value={symbol}
                onChange={(e) => {
                  setSymbol(e.target.value.toUpperCase());
                  setQuoteCheck({ status: 'idle' });
                }}
                className="col-span-3"
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                {t('trading.addPositionDialog.nameLabel')}
              </Label>
              <Input
                id="name"
                placeholder={t('trading.addPositionDialog.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                {t('trading.addPositionDialog.quantityLabel')}
              </Label>
              <DecimalInput
                id="quantity"
                placeholder={t('trading.addPositionDialog.quantityPlaceholder')}
                value={quantity}
                onChange={setQuantity}
                className="col-span-3"
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="entryPrice" className="text-right">
                {t('trading.addPositionDialog.entryPriceLabel')}
              </Label>
              <DecimalInput
                id="entryPrice"
                placeholder={t('trading.addPositionDialog.entryPricePlaceholder')}
                value={entryPrice}
                onChange={setEntryPrice}
                className="col-span-3"
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="currency" className="text-right">
                {t('trading.addPositionDialog.currencyLabel')}
              </Label>
              <Select
                value={currency}
                onValueChange={setCurrency}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <SelectTrigger className="col-span-3" aria-label={t('trading.addPositionDialog.currencyLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">{t('trading.addPositionDialog.currencyEur')}</SelectItem>
                  <SelectItem value="USD">{t('trading.addPositionDialog.currencyUsd')}</SelectItem>
                  <SelectItem value="GBP">{t('trading.addPositionDialog.currencyGbp')}</SelectItem>
                  <SelectItem value="CHF">{t('trading.addPositionDialog.currencyChf')}</SelectItem>
                  <SelectItem value="BTC">{t('trading.addPositionDialog.currencyBtc')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="exchange" className="text-right">
                {t('trading.addPositionDialog.exchangeLabel')}
              </Label>
              <Input
                id="exchange"
                placeholder={t('trading.addPositionDialog.exchangePlaceholder')}
                value={exchange}
                onChange={(e) => {
                  setExchange(e.target.value);
                  setQuoteCheck({ status: 'idle' });
                }}
                className="col-span-3"
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <div />
              <div className="col-span-3 space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestQuote}
                  disabled={!symbol.trim() || quoteCheck.status === 'checking'}
                >
                  {quoteCheck.status === 'checking' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  {t('trading.addPositionDialog.testQuoteButton')}
                </Button>
                {quoteCheck.status === 'found' && (
                  <p className="text-sm text-positive dark:text-positive">
                    {t('trading.addPositionDialog.messages.quoteFound')
                      .replace('{price}', formatCurrency(quoteCheck.price, quoteCheck.currency || currency))}
                  </p>
                )}
                {quoteCheck.status === 'not-found' && (
                  <p className="text-sm text-warning dark:text-warning">
                    {t('trading.addPositionDialog.messages.quoteNotFound')}
                  </p>
                )}
                {quoteCheck.status === 'error' && (
                  <p className="text-sm text-warning dark:text-warning">
                    {t('trading.addPositionDialog.messages.quoteCheckError').replace('{error}', quoteCheck.message)}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="buyDate" className="text-right">
                {t('trading.addPositionDialog.buyDateLabel')}
              </Label>
              <Input
                id="buyDate"
                type="date"
                value={buyDate}
                onChange={(e) => setBuyDate(e.target.value)}
                className="col-span-3"
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {t('trading.addPositionDialog.cancelButton')}
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending)
                ? t('trading.addPositionDialog.savingButton')
                : isEditing
                ? t('trading.addPositionDialog.updateButton')
                : t('trading.addPositionDialog.saveButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}