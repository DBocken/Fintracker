import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Calendar, DollarSign, TrendingUp } from 'lucide-react';

interface ScrollableSummaryProps {
  transactionCount: number;
  totalExpenses: number;
  totalIncome: number;
  categoryCount: number;
}

export function ScrollableSummary({ transactionCount, totalExpenses, totalIncome, categoryCount }: ScrollableSummaryProps) {
  const items = [
    { icon: Target, label: 'Transaktionen', value: transactionCount },
    { icon: Calendar, label: 'Ø/Tag', value: `€${Math.round(totalExpenses / 30)}` },
    { icon: TrendingUp, label: 'Sparquote', value: `${totalIncome > 0 ? Math.round((totalIncome - totalExpenses) / totalIncome * 100) : 0}%` },
    { icon: DollarSign, label: 'Kategorien', value: categoryCount },
  ];

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {items.map((item, index) => (
        <Card key={index} className="flex-shrink-0 w-32 border-0 bg-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-gray-400 flex items-center gap-1">
              <item.icon className="h-3 w-3" />
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-bold text-white">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}