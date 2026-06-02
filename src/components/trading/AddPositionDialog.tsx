"use client";

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
      setBuyDate(editPosition.metadata?.buy_date || '');
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
      toast.success('Position erfolgreich hinzugefügt');
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(`Fehler beim Hinzufügen: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (position: { id: string; updates: Partial<PortfolioPosition> }) => {
      return await updatePosition(position.id, position.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-positions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary', portfolioId] });
      toast.success('Position erfolgreich aktualisiert');
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(`Fehler beim Aktualisieren: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!symbol.trim()) {
      toast.error('Bitte geben Sie ein Symbol ein');
      return;
    }

    // Validate symbol format (A-Z, 0-9, dot, hyphen)
    const symbolRegex = /^[A-Z0-9.-]+$/;
    if (!symbolRegex.test(symbol.trim().toUpperCase())) {
      toast.error('Ungültiges Symbol-Format');
      return;
    }

    const quantityNum = parseFloat(quantity);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      toast.error('Bitte geben Sie eine gültige Menge ein');
      return;
    }

    const entryPriceNum = parseFloat(entryPrice);
    if (isNaN(entryPriceNum) || entryPriceNum < 0) {
      toast.error('Bitte geben Sie einen gültigen Einstiegspreis ein');
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
            {isEditing ? 'Position bearbeiten' : 'Position hinzufügen'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Bearbeiten Sie die Details für Ihre Position.'
              : 'Geben Sie die Details für Ihre neue Position ein.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="symbol" className="text-right">
                Symbol *
              </Label>
              <Input
                id="symbol"
                placeholder="z.B. AAPL, SAP, VOW3, BTC"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="col-span-3"
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                placeholder="z.B. Apple Inc."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Menge *
              </Label>
              <Input
                id="quantity"
                type="number"
                step="any"
                min="0"
                placeholder="z.B. 10"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="col-span-3"
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="entryPrice" className="text-right">
                Einstiegspreis *
              </Label>
              <Input
                id="entryPrice"
                type="number"
                step="any"
                min="0"
                placeholder="z.B. 178.50"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="col-span-3"
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="currency" className="text-right">
                Währung *
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
                  <SelectItem value="EUR">EUR (Euro)</SelectItem>
                  <SelectItem value="USD">USD (US-Dollar)</SelectItem>
                  <SelectItem value="GBP">GBP (Britisches Pfund)</SelectItem>
                  <SelectItem value="CHF">CHF (Schweizer Franken)</SelectItem>
                  <SelectItem value="BTC">BTC (Bitcoin)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="exchange" className="text-right">
                Börse
              </Label>
              <Input
                id="exchange"
                placeholder="z.B. NASDAQ, XETRA"
                value={exchange}
                onChange={(e) => setExchange(e.target.value)}
                className="col-span-3"
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="buyDate" className="text-right">
                Kaufdatum
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
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending)
                ? 'Speichern...'
                : isEditing
                ? 'Aktualisieren'
                : 'Speichern'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}