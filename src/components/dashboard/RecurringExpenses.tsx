import React, { useMemo } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Calendar, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'yearly';
  nextDue: Date;
  category: string;
  daysUntilDue: number;
}

interface RecurringExpensesProps {
  transactions: any[];
}

export const RecurringExpenses: React.FC<RecurringExpensesProps> = ({ transactions }) => {
  const recurringExpenses = useMemo(() => {
    const expenseMap = new Map<string, { total: number; count: number; dates: Date[] }>();
    
    transactions
      .filter(t => t.amount < 0)
      .forEach(t => {
        const key = t.recipient?.toLowerCase() || 'unknown';
        const existing = expenseMap.get(key) || { total: 0, count: 0, dates: [] };
        expenseMap.set(key, {
          total: existing.total + Math.abs(t.amount),
          count: existing.count + 1,
          dates: [...existing.dates, t.date]
        });
      });

    return Array.from(expenseMap.entries())
      .filter(([_, data]) => data.count >= 2)
      .map(([name, data]) => ({
        id: name,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        amount: data.total / data.count,
        frequency: 'monthly' as const,
        nextDue: new Date(new Date().setDate(1)),
        category: 'Recurring',
        daysUntilDue: Math.ceil((new Date().getTime() - data.dates[data.dates.length - 1].getTime()) / (1000 * 60 * 60 * 24))
      }))
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }, [transactions]);

  const getStatusColor = (daysUntilDue: number) => {
    if (daysUntilDue <= 3) return 'destructive' as const;
    if (daysUntilDue <= 7) return 'default' as const;
    return 'default' as const;
  };

  const getStatusText = (daysUntilDue: number) => {
    if (daysUntilDue <= 0) return 'Overdue';
    if (daysUntilDue === 1) return 'Due tomorrow';
    if (daysUntilDue <= 7) return `Due in ${daysUntilDue} days`;
    return formatDate(new Date());
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Recurring Expenses</h2>
        <p className="text-muted-foreground">
          Track your regular payments and subscriptions
        </p>
      </div>

      <div className="grid gap-4">
        {recurringExpenses.map((expense) => (
          <Card key={expense.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{expense.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {expense.frequency} • {expense.category}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(expense.amount)}</p>
                <Badge variant={getStatusColor(expense.daysUntilDue)}>
                  {getStatusText(expense.daysUntilDue)}
                </Badge>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {recurringExpenses.length === 0 && (
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No recurring expenses detected yet. Upload more transactions to see patterns.
          </p>
        </Card>
      )}
    </div>
  );
};