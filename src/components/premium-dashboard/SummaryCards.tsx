import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface SummaryCardsProps {
  transactionCount: number;
  totalExpenses: number;
  totalIncome: number;
  categoryCount: number;
}

export function SummaryCards({ transactionCount, totalExpenses, totalIncome, categoryCount }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Gesamt Transaktionen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{transactionCount}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Durchschnitt/Tag</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(totalExpenses / 30).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sparquote</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : '0'}%
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Kategorien</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{categoryCount}</div>
        </CardContent>
      </Card>
    </div>
  );
}