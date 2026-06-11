import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

interface CompactCashflowCardProps {
  totalIncome: number;
  totalExpenses: number;
}

export function CompactCashflowCard({ totalIncome, totalExpenses }: CompactCashflowCardProps) {
  return (
    <Card className="border-0 bg-gradient-to-br from-gray-800 to-gray-900 shadow-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-sm flex items-center gap-2">
          Cashflow Übersicht
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <ArrowUpCircle className="h-4 w-4 text-positive" />
          <div>
            <p className="text-xs text-gray-400">Einnahmen</p>
            <p className="text-lg font-bold text-positive">
              {totalIncome.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ArrowDownCircle className="h-4 w-4 text-warning" />
          <div>
            <p className="text-xs text-gray-400">Ausgaben</p>
            <p className="text-lg font-bold text-warning">
              {totalExpenses.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}