"use client";

import { ArrowUpCircle, ArrowDownCircle, Wallet } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface TransactionStatsProps {
  income: number;
  expenses: number;
  balance: number;
  count: number;
  totalTransactions: number;
  currentBalance: string;
}

export function TransactionStats({ 
  income, 
  expenses, 
  count, 
  totalTransactions, 
  currentBalance 
}: TransactionStatsProps) {
  return (
    <div className="grid md:grid-cols-5 gap-4">
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5" /> Einnahmen
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-600 text-2xl">{income.toFixed(2)}€</CardContent>
      </Card>
      
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5" /> Ausgaben
          </CardTitle>
        </CardHeader>
        <CardContent className="text-red-600 text-2xl">{expenses.toFixed(2)}€</CardContent>
      </Card>
      
      <Card className="card-premium">
        <CardHeader>
          <CardTitle>Transaktionen</CardTitle>
        </CardHeader>
        <CardContent>{count} von {totalTransactions}</CardContent>
      </Card>
      
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" /> Kontostand
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-600 text-2xl">{currentBalance}</CardContent>
      </Card>
    </div>
  );
}