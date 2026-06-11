import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

interface IncomeCardProps {
  totalIncome: number;
  incomeSources: Array<{ name: string; amount: number }>;
}

export function IncomeCard({ totalIncome, incomeSources }: IncomeCardProps) {
  return (
    <Card className="border-l-4 border-l-positive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowLeft className="h-5 w-5 text-positive" />
          Einnahmen-Quellen
        </CardTitle>
        <CardDescription>
          Geldzufluss auf dein Konto
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-positive mb-4">
          {totalIncome.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
        </div>
        <div className="space-y-2">
          {incomeSources.map((source) => (
            <div key={source.name} className="flex justify-between items-center">
              <span className="text-sm">{source.name}</span>
              <span className="text-sm font-medium">
                {source.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}