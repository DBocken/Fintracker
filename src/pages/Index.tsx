import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { FileUploader } from '@/components/upload/FileUploader';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { MixedChart } from '@/components/charts/MixedChart';
import { TransactionTable } from '@/components/transactions/TransactionTable';
import { RecurringExpenses } from '@/components/dashboard/RecurringExpenses';
import { BudgetGoals } from '@/components/dashboard/BudgetGoals';
import { RuleBuilder } from '@/components/categorization/RuleBuilder';
import { LiquidityReport } from '@/components/dashboard/LiquidityReport';
import { Tabs } from '@/components/dashboard/Tabs';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, FileText, Target, Repeat, Settings, BarChart3 } from 'lucide-react';
import { formatCurrency, calculateFinancialHealth, formatDate, getCurrentGermanDate } from '@/lib/dateUtils';
import { calculateForecast } from '@/lib/forecast';

// Simple in-memory storage for client-side
interface Transaction {
  id: number;
  date: Date;
  amount: number;
  recipient?: string;
  category?: string;
}

interface Rule {
  matches: (transaction: Transaction) => boolean;
  category: string;
}

let transactions: Transaction[] = [];
let rules: Rule[] = [];

const Index: React.FC = () => {
  const [showUpload, setShowUpload] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [transactionData, setTransactionData] = useState<Transaction[]>([]);
  const [ruleData, setRuleData] = useState<Rule[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    // Load from localStorage
    const savedTransactions = localStorage.getItem('fintrack-transactions');
    const savedRules = localStorage.getItem('fintrack-rules');
    
    if (savedTransactions) {
      transactions = (JSON.parse(savedTransactions) as Transaction[]).map(t => ({
        ...t,
        date: new Date(t.date),
        amount: Number(t.amount)
      }));
      setTransactionData(transactions);
      setShowUpload(transactions.length === 0);
    }
    
    if (savedRules) {
      rules = JSON.parse(savedRules);
      setRuleData(rules);
    }
  };

  const handleFileUploaded = (newTransactions: Transaction[]) => {
    transactions = newTransactions.map((t, index) => ({
      ...t,
      id: index + 1,
      date: new Date(t.date)
    }));
    localStorage.setItem('fintrack-transactions', JSON.stringify(transactions));
    setTransactionData(transactions);
    setShowUpload(false);
  };

  const handleCategoryChange = (id: number, category: string) => {
    transactions = transactions.map(t => 
      t.id === id ? { ...t, category } : t
    );
    localStorage.setItem('fintrack-transactions', JSON.stringify(transactions));
    setTransactionData([...transactions]);
  };

  const applyRules = () => {
    // Apply rules to transactions
    transactions = transactions.map(transaction => {
      for (const rule of rules) {
        if (rule.matches(transaction)) {
          return { ...transaction, category: rule.category };
        }
      }
      return transaction;
    });
    localStorage.setItem('fintrack-transactions', JSON.stringify(transactions));
    setTransactionData([...transactions]);
  };

  const tabs = [
    { id: 'overview', label: 'Übersicht', icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'transactions', label: 'Transaktionen', icon: <FileText className="h-4 w-4" /> },
    { id: 'recurring', label: 'Wiederkehrend', icon: <Repeat className="h-4 w-4" /> },
    { id: 'budgets', label: 'Budgets', icon: <Target className="h-4 w-4" /> },
    { id: 'rules', label: 'Regeln', icon: <Settings className="h-4 w-4" /> },
    { id: 'liquidity', label: 'Liquidität', icon: <BarChart3 className="h-4 w-4" /> },
  ];

  const totalIncome = transactionData
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = Math.abs(
    transactionData
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0)
  );

  const financialHealth = calculateFinancialHealth(transactionData);

  // Forecast configuration: add or remove parameters as needed
  const regularIncomes = [
    { amount: 3000, category: 'Gehalt' },
  ];

  const contracts = [
    { amount: -800, category: 'Miete' },
    { amount: -200, category: 'Versicherung' },
  ];

  const budgets = [
    { category: 'Freizeit', limit: 300 },
  ];

  const forecastData = calculateForecast({
    initialBalance: totalIncome - totalExpenses,
    incomes: regularIncomes,
    contracts,
    budgets,
    months: 6,
  });

  const chartData = forecastData.map(m => ({
    month: m.month,
    income: m.income,
    expenses: m.expenses,
    forecast: m.balance,
    scenario1: m.balance,
  }));

  if (showUpload && transactionData.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-2xl w-full p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">FinTrack V2</h1>
            <p className="text-xl text-muted-foreground">
              Laden Sie Ihre Finanzdaten hoch. Verfolgen Sie alles. Keine Tabellenkalkulationen.
            </p>
            <p className="text-sm text-muted-foreground">
              Stand: {getCurrentGermanDate()}
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
          <h1 className="text-3xl font-bold mb-2">Willkommen bei FinTrack</h1>
          <p className="text-muted-foreground">
            Ihre Finanzübersicht auf einen Blick
          </p>
          <p className="text-sm text-muted-foreground">
            Stand: {getCurrentGermanDate()}
          </p>
        </div>

        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <DashboardCard
                title="Gesamteinnahmen"
                value={formatCurrency(totalIncome)}
                change="+12,5% zum letzten Monat"
                changeType="positive"
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <DashboardCard
                title="Gesamtausgaben"
                value={formatCurrency(totalExpenses)}
                change="-8,2% zum letzten Monat"
                changeType="negative"
                icon={<TrendingDown className="h-5 w-5" />}
              />
              <DashboardCard
                title="Nettosaldo"
                value={formatCurrency(totalIncome - totalExpenses)}
                change="+450€ diesen Monat"
                changeType="positive"
                icon={<DollarSign className="h-5 w-5" />}
              />
              <DashboardCard
                title="Finanzgesundheit"
                value={`${financialHealth.toFixed(0)}%`}
                change={financialHealth > 80 ? "Exzellent" : financialHealth > 60 ? "Gut" : "Achtung erforderlich"}
                changeType={financialHealth > 80 ? "positive" : financialHealth > 60 ? "neutral" : "negative"}
                icon={<AlertCircle className="h-5 w-5" />}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Cashflow-Prognose</h2>
                <MixedChart data={chartData} />
              </div>
              
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Letzte Transaktionen</h2>
                <div className="space-y-3">
                  {transactionData.slice(0, 5).map((transaction, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                      <div>
                        <p className="font-medium">{transaction.recipient || 'Unbekannt'}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(transaction.date)}
                        </p>
                      </div>
                      <span className={transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(transaction.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <TransactionTable 
            transactions={transactionData} 
            onCategoryChange={handleCategoryChange}
          />
        )}

        {activeTab === 'recurring' && (
          <RecurringExpenses transactions={transactionData} />
        )}

        {activeTab === 'budgets' && (
          <BudgetGoals transactions={transactionData} />
        )}

        {activeTab === 'rules' && (
          <RuleBuilder onRulesUpdated={loadData} />
        )}

        {activeTab === 'liquidity' && (
          <LiquidityReport transactions={transactionData} />
        )}
      </div>
    </MainLayout>
  );
};

export default Index;