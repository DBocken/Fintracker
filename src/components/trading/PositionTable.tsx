import { useState } from 'react';
import type { PortfolioPosition } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
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
import { ArrowUp, ArrowDown, Trash2, Edit } from 'lucide-react';
import { formatNumber, formatCurrency } from '@/lib/utils';

interface PositionTableProps {
  positions: PortfolioPosition[];
  onEdit?: (position: PortfolioPosition) => void;
  onDelete?: (id: string) => void;
  currency?: string;
}

type SortField = 'symbol' | 'quantity' | 'entry_price' | 'current_price' | 'gain_loss' | 'gain_loss_percent';
type SortDirection = 'asc' | 'desc';

export default function PositionTable({
  positions,
  onEdit,
  onDelete,
  currency = 'EUR',
}: PositionTableProps) {
  const [sortField, setSortField] = useState<SortField>('gain_loss');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedPositions = [...positions].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1;

    switch (sortField) {
      case 'symbol':
        return multiplier * a.symbol.localeCompare(b.symbol);
      
      case 'quantity':
        return multiplier * (a.quantity - b.quantity);
      
      case 'entry_price':
        return multiplier * (a.entry_price - b.entry_price);
      
      case 'current_price':
        return multiplier * ((a.last_price || a.entry_price) - (b.last_price || b.entry_price));
      
      case 'gain_loss': {
        const gainA = calculateGainLoss(a);
        const gainB = calculateGainLoss(b);
        return multiplier * (gainA - gainB);
      }
      
      case 'gain_loss_percent': {
        const gainA = calculateGainLossPercent(a);
        const gainB = calculateGainLossPercent(b);
        return multiplier * (gainA - gainB);
      }
      
      default:
        return 0;
    }
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-1 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-1 h-4 w-4" />
    );
  };

  if (positions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-center">
        <div className="space-y-2">
          <p className="text-lg font-medium">Keine Positionen vorhanden</p>
          <p className="text-sm text-muted-foreground">
            Fügen Sie Ihre erste Position hinzu, um Ihr Portfolio aufzubauen.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('symbol')}>
              <div className="flex items-center">
                Symbol
                {getSortIcon('symbol')}
              </div>
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('quantity')}>
              <div className="flex items-center justify-end">
                Menge
                {getSortIcon('quantity')}
              </div>
            </TableHead>
            <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('entry_price')}>
              <div className="flex items-center justify-end">
                Einstiegspreis
                {getSortIcon('entry_price')}
              </div>
            </TableHead>
            <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('current_price')}>
              <div className="flex items-center justify-end">
                Aktueller Kurs
                {getSortIcon('current_price')}
              </div>
            </TableHead>
            <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('gain_loss')}>
              <div className="flex items-center justify-end">
                Gewinn/Verlust
                {getSortIcon('gain_loss')}
              </div>
            </TableHead>
            <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('gain_loss_percent')}>
              <div className="flex items-center justify-end">
                %
                {getSortIcon('gain_loss_percent')}
              </div>
            </TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedPositions.map((position) => {
            const currentPrice = position.last_price || position.entry_price;
            const gainLoss = calculateGainLoss(position);
            const gainLossPercent = calculateGainLossPercent(position);
            const isPositive = gainLoss >= 0;

            return (
              <TableRow key={position.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>{position.symbol}</span>
                    {position.exchange && (
                      <Badge variant="outline" className="text-xs">
                        {position.exchange}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {position.name || '-'}
                </TableCell>
                <TableCell className="text-right">
                  {formatNumber(position.quantity)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(position.entry_price, position.currency)}
                </TableCell>
                <TableCell className="text-right">
                  {position.last_price ? (
                    <span className="text-green-600 dark:text-green-400">
                      {formatCurrency(currentPrice, position.currency)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {formatCurrency(currentPrice, position.currency)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <span className={isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {isPositive ? '+' : ''}
                    {formatCurrency(gainLoss, currency)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className={isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {isPositive ? '+' : ''}
                    {gainLossPercent.toFixed(2)}%
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 justify-end">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(position)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {onDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Position löschen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Möchten Sie die Position {position.symbol} wirklich löschen?
                              Diese Aktion kann nicht rückgängig gemacht werden.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(position.id)}>
                              Löschen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function calculateGainLoss(position: PortfolioPosition): number {
  const currentPrice = position.last_price || position.entry_price;
  return (currentPrice - position.entry_price) * position.quantity;
}

function calculateGainLossPercent(position: PortfolioPosition): number {
  const currentPrice = position.last_price || position.entry_price;
  if (position.entry_price === 0) return 0;
  return ((currentPrice - position.entry_price) / position.entry_price) * 100;
}
