// Simplified date utilities without external dependencies
export function formatDate(date: Date | string, format?: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

interface AmountLike {
  amount: number;
}

export function calculateFinancialHealth(transactions: AmountLike[]): number {
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

export function getCurrentGermanDate(): string {
  return new Date().toLocaleDateString('de-DE');
}

export function getBusinessDay(date: Date): string {
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  return days[date.getDay()];
}

export function getGermanQuarter(date: Date): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${quarter}. Quartal ${date.getFullYear()}`;
}

export function parseGermanNumber(str: string): number {
  const normalized = str
    .replace(/[^0-9,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return parseFloat(normalized);
}

export function parseGermanDate(str: string): Date | null {
  if (!str) return null;
  const match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (match) {
    const [, day, month, year] = match;
    const fullYear = year.length === 2 ? `20${year}` : year;
    const date = new Date(Number(fullYear), Number(month) - 1, Number(day));
    return isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date;
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

export function cn(...inputs: unknown[]): string {
  return inputs.filter(Boolean).join(' ');
}