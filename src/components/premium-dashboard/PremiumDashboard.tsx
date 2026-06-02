"use client";

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { getTransactions, getCategories } from '../../services/transaction-service';
import { parseISO, subDays } from 'date-fns'; // Removed 'format' and 'de'
import type { Transaction, Category } from '../../types';

export function PremiumDashboard() {
  const [timeRange] = useState('30d'); // Removed setTimeRange
  const [animatedValues, setAnimatedValues] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    transactionCount: 0,
  });

  const { data: transactions } = useQuery<Transaction[]>({
    queryKey: ['transactions', timeRange],
    queryFn: () => getTransactions(1000),
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (timeRange) {
      case '7d': return { start: subDays(now, 7), end: now };
      case '30d': return { start: subDays(now, 30), end: now };
      case '90d': return { start: subDays(now, 90), end: now };
      case '1y': return { start: subDays(now, 365), end: now };
      default: return { start: subDays(now, 30), end: now };
    }
  }, [timeRange]);

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(t => {
      const transactionDate = parseISO(t.date);
      return transactionDate >= dateRange.start && transactionDate <= dateRange.end;
    });
  }, [transactions, dateRange]);

  const financialData = useMemo(() => {
    if (!filteredTransactions || !filteredTransactions.length) return null;
    
    const totalIncome = filteredTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = Math.abs(filteredTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));

    return {
      totalIncome,
      totalExpenses,
      transactionCount: filteredTransactions.length,
    };
  }, [filteredTransactions, categories]);

  // Animate values
  useEffect(() => {
    if (financialData) {
      const duration = 1000;
      const steps = 60;
      const stepDuration = duration / steps;
      
      let currentStep = 0;
      const interval = setInterval(() => {
        const progress = currentStep / steps;
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        setAnimatedValues({
          totalIncome: Math.round(financialData.totalIncome * easeOut),
          totalExpenses: Math.round(financialData.totalExpenses * easeOut),
          transactionCount: Math.round(financialData.transactionCount * easeOut),
        });
        
        currentStep++;
        if (currentStep > steps) {
          clearInterval(interval);
        }
      }, stepDuration);
      
      return () => clearInterval(interval);
    }
  }, [financialData]);


  if (!financialData) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Keine Transaktionen verfügbar</p>
          <p className="text-sm text-muted-foreground mt-2">
            Importiere deine Bank-CSV um das Dashboard zu sehen
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-white text-2xl">Premium Dashboard</h1>
        <p className="text-gray-400">Einnahmen: {animatedValues.totalIncome.toFixed(2)}€</p>
        <p className="text-gray-400">Ausgaben: {animatedValues.totalExpenses.toFixed(2)}€</p>
        <p className="text-gray-400">Transaktionen: {animatedValues.transactionCount}</p>
      </div>
    </div>
  );
}