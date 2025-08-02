import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { FileUploader } from '@/components/upload/FileUploader';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { MixedChart } from '@/components/charts/MixedChart';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react';

const Index: React.FC = () => {
  const [showUpload, setShowUpload] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);

  const handleFileUploaded = (newTransactions: any[]) => {
    setTransactions(newTransactions);
    setShowUpload(false);
  };

  const chartData = [
    { month: 'Jan', income: 5000, expenses: 3200, forecast: 4800, scenario1: 5200 },
    { month: 'Feb', income: 4800, expenses: 2900, forecast: 4700, scenario1: 5100 },
    { month: 'Mar', income: 5200, expenses: 3500, forecast: 4900, scenario1: 5300 },
    { month: 'Apr', income: 4900, expenses: 3100, forecast: 4850, scenario1: 5150 },
    { month: 'May', income: 5300, expenses: 3300, forecast: 5000, scenario1: 5400 },
    { month: 'Jun', income: 5100, expenses: 3000, forecast: 4950, scenario1: 5250 },
  ];

  const totalIncome = transactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = Math.abs(
    transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0)
  );

  if (showUpload && transactions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-2xl w-full p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">FinTrack V2</h1>
            <p className="text-xl text-muted-foreground">
              Upload your financial data. Track everything. No spreadsheets.
            </p>
          </div>
          <FileUploader onFileUploaded={handleFileUploaded} />
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Welcome to FinTrack</h1>
          <p className="text-muted-foreground">
            Your financial overview at a glance
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <DashboardCard
            title="Total Income"
            value={`€${totalIncome.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`}
            change="+12.5% from last month"
            changeType="positive"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <DashboardCard
            title="Total Expenses"
            value={`€${totalExpenses.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`}
            change="-8.2% from last month"
            changeType="negative"
            icon={<TrendingDown className="h-5 w-5" />}
          />
          <DashboardCard
            title="Net Balance"
            value={`€${(totalIncome - totalExpenses).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`}
            change="+€450 this month"
            changeType="positive"
            icon={<DollarSign className="h-5 w-5" />}
          />
          <DashboardCard
            title="Financial Health"
            value="85%"
            change="Good financial standing"
            changeType="positive"
            icon={<AlertCircle className="h-5 w-5" />}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Cashflow Forecast</h2>
            <MixedChart data={chartData} />
          </div>
          
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>
            <div className="space-y-3">
              {transactions.slice(0, 5).map((transaction, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium">{transaction.recipient || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">
                      {transaction.date.toLocaleDateString('de-DE')}
                    </p>
                  </div>
                  <span className={transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                    {transaction.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;