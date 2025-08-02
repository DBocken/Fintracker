import React from 'react';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';

interface LiquidityReportProps {
  transactions: any[];
}

export const LiquidityReport: React.FC<LiquidityReportProps> = ({ transactions }) => {
  // Calculate liquidity metrics
  const currentBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
  
  // Calculate 30-day liquidity forecast
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentExpenses = transactions
    .filter(t => t.date >= thirtyDaysAgo && t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const avgDailyExpense = recentExpenses / 30;
  const daysOfLiquidity = currentBalance > 0 ? Math.floor(currentBalance / avgDailyExpense) : 0;
  
  // Calculate liquidity percentage
  const monthlyIncome = transactions
    .filter(t => t.date >= thirtyDaysAgo && t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const liquidityRatio = monthlyIncome > 0 ? (currentBalance / monthlyIncome) * 100 : 0;
  
  // Determine traffic light status
  const getStatus = () => {
    if (liquidityRatio >= 100) return { color: 'green', label: 'Excellent', icon: CheckCircle };
    if (liquidityRatio >= 80) return { color: 'yellow', label: 'Good', icon: AlertTriangle };
    return { color: 'red', label: 'Critical', icon: XCircle };
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Liquidity Report</h2>
        <p className="text-muted-foreground">
          Current financial liquidity status and forecast
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Traffic Light Indicator */}
        <Card className="p-6">
          <div className="text-center">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
              status.color === 'green' ? 'bg-green-100 text-green-600' :
              status.color === 'yellow' ? 'bg-yellow-100 text-yellow-600' :
              'bg-red-100 text-red-600'
            }`}>
              <StatusIcon className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Liquidity Status</h3>
            <p className={`text-3xl font-bold mb-1 ${
              status.color === 'green' ? 'text-green-600' :
              status.color === 'yellow' ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {liquidityRatio.toFixed(0)}%
            </p>
            <p className="text-sm text-muted-foreground">{status.label}</p>
          </div>
        </Card>

        {/* Current Balance */}
        <Card className="p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Current Balance</h3>
            <p className="text-3xl font-bold mb-1">{formatCurrency(currentBalance)}</p>
            <p className="text-sm text-muted-foreground">As of {formatDate(new Date())}</p>
          </div>
        </Card>

        {/* Days of Liquidity */}
        <Card className="p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Days of Liquidity</h3>
            <p className="text-3xl font-bold mb-1">{daysOfLiquidity}</p>
            <p className="text-sm text-muted-foreground">Days at current spending rate</p>
          </div>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h4 className="font-medium mb-2">30-Day Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Income:</span>
              <span className="text-green-600">{formatCurrency(monthlyIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Expenses:</span>
              <span className="text-red-600">{formatCurrency(recentExpenses)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Net Flow:</span>
              <span className={monthlyIncome - recentExpenses >= 0 ? 'text-green-600' : 'text-red-600'}>
                {formatCurrency(monthlyIncome - recentExpenses)}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="font-medium mb-2">Daily Metrics</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Daily Expense:</span>
              <span>{formatCurrency(avgDailyExpense)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Liquidity Ratio:</span>
              <span>{liquidityRatio.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Risk Level:</span>
              <span className={`font-medium ${
                status.color === 'green' ? 'text-green-600' :
                status.color === 'yellow' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {status.label}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recommendations */}
      <Card className="p-4">
        <h4 className="font-medium mb-2">Recommendations</h4>
        <div className="text-sm">
          {status.color === 'green' && (
            <p className="text-green-600">
              ✓ Excellent liquidity position. Consider investing excess funds.
            </p>
          )}
          {status.color === 'yellow' && (
            <p className="text-yellow-600">
              ⚠ Good liquidity but monitor expenses closely. Consider building emergency fund.
            </p>
          )}
          {status.color === 'red' && (
            <p className="text-red-600">
              ⚠ Critical liquidity. Reduce expenses immediately and increase income sources.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};