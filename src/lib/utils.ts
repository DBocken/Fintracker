import { formatDate, formatCurrency, formatNumber } from './dateUtils';

export function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

export { formatDate, formatCurrency, formatNumber };

export function calculateFinancialHealth(transactions: any[]): number {
  const totalIncome = transactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalExpenses = Math.abs(
    transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0)
  );
  
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  return Math.max(0, Math.min(100, savingsRate));
}

export function parseCSV(text: string): Record<string, string>[] {
  const rows = text.split('\n').slice(1).filter(row => row.trim());
  return rows.map(row => {
    const [date, amount, recipient] = row.split(';');
    return {
      date: date || '',
      amount: amount || '',
      recipient: recipient || ''
    };
  });
}

export function parseGermanNumber(str: string): number {
  return parseFloat(str.replace(/\./g, '').replace(',', '.'));
}