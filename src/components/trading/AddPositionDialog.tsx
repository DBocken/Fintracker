import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n/useI18n';
import type { PortfolioPosition } from '@/types';
import { createPosition, updatePosition } from '@/services/portfolio-service';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';

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
  const [quantity, setQuantity] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [exchange, setExchange] = useState('');
  const [buyDate, setBuyDate] = useState('');

  const isEditing = !!editPosition;

  // Populate form when editing
  useEffect(() => {
    if (editPosition) {
      setSymbol(editPosition.symbol);
      setName(editPosition.name || '');
      setQuantity(editPosition.quantity.toString());
      setEntryPrice(editPosition.entry_price.toString());
      setCurrency(editPosition.currency || 'EUR');
      setExchange(editPosition.exchange || '');
      setBuyDate((editPosition.metadata?.buy_date as string | undefined) || '');
    } else {
      // Reset form for new position
      setSymbol('');
      setName('');
      setQuantity('');
      setEntryPrice('');
      setCurrency('EUR');
      setExchange('');
      setBuyDate('');
    }
  }, [editPosition, open]);

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

    const quantityNum = parseFloat(quantity);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      toast.error(t('trading.addPositionDialog.messages.quantityInvalid'));
      return;
    }

    const entryPriceNum = parseFloat(entryPrice);
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
    setQuantity('');
    setEntryPrice('');
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
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
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
              <Input
                id="quantity"
                type="number"
                step="any"
                min="0"
                placeholder={t('trading.addPositionDialog.quantityPlaceholder')}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="col-span-3"
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="entryPrice" className="text-right">
                {t('trading.addPositionDialog.entryPriceLabel')}
              </Label>
              <Input
                id="entryPrice"
                type="number"
                step="any"
                min="0"
                placeholder={t('trading.addPositionDialog.entryPricePlaceholder')}
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
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
                <SelectTrigger className="col-span-3">
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
                onChange={(e) => setExchange(e.target.value)}
                className="col-span-3"
                disabled={createMutation.isPending || updateMutation.isPending}
              />
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