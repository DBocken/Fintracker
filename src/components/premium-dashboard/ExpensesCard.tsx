import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

interface ExpensesCardProps {
  totalExpenses: number;
  expenseCategories: Array<{ name: string; amount: number }>;
}

export function ExpensesCard({ totalExpenses, expenseCategories }: ExpensesCardProps) {
  return (
    <Card className="border-l-4 border-l-red-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRight className="h-5 w-5 text-red-600" />
          Ausgaben-Ziele
        </CardTitle>
        <CardDescription>
          Geldabfluss von deinem Konto
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-red-600 mb-4">
          {totalExpenses.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
        </div>
        <div className="space-y-2">
          {expenseCategories.map((category) => (
            <div key={category.name} className="flex justify-between items-center">
              <span className="text-sm">{category.name}</span>
              <span className="text-sm font-medium">
                {category.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}