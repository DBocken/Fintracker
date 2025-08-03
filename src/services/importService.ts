import { Transaction } from '../types';
import { saveTransactions } from '../lib/db';
import { parseGermanDate, parseGermanNumber } from '../lib/dateUtils';

export const ImportService = {
  async importCSV(file: File): Promise<Transaction[]> {
    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);
    if (!lines.length) return [];
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const transactions: Transaction[] = [];

    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const cols = line.split(',');
      const record: Record<string, string> = {};
      header.forEach((h, i) => (record[h] = cols[i] ? cols[i].trim() : ''));

      const dateStr = record['datum'];
      const amountStr = record['betrag'];
      const recipient = record['empfaenger'];



      if (!parsedDate || isNaN(parsedDate.getTime()) || isNaN(amount) || !recipient)
        continue;

      const transaction: Transaction = {
        date: parsedDate.toISOString(),
        amount,
        recipient,
        category: null,
        raw: record
      };
      transactions.push(transaction);
    }

    await saveTransactions(transactions);
    return transactions;
  }
};
