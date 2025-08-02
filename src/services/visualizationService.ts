import { Transaction } from '../types';

export const VisualizationService = {
  getSpendingByMonth(transactions: Transaction[]): { month: string; amount: number }[] {
    const map: Record<string, number> = {};
    transactions.forEach(tx => {
      const month = new Date(tx.date).toISOString().slice(0, 7);
      map[month] = (map[month] || 0) + tx.amount;
    });
    return Object.entries(map).map(([month, amount]) => ({ month, amount }));
  }
};
