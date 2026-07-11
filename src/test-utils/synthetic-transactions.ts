import type { Transaction } from '@/types';

/**
 * Deterministische Transaktions-Factory für Perf-/Stress-Tests: verteilt n
 * Buchungen gleichmäßig über ~24 Monate (neueste zuerst, wie die Storage-
 * Schicht liefert). Bewusst ohne Zufall, damit Läufe reproduzierbar sind.
 */
export function makeSyntheticTransactions(n: number): Transaction[] {
  const PAYEES = ['Rewe', 'Miete', 'Stadtwerke', 'Bäckerei', 'Versicherung', 'Gehalt'];
  const transactions: Transaction[] = [];
  const start = new Date('2026-07-01T00:00:00Z');

  for (let i = 0; i < n; i++) {
    // ~14 Buchungen pro Tag bei 10k über 24 Monate; Datum monoton fallend.
    const day = Math.floor(i / Math.max(1, Math.ceil(n / 730)));
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() - day);
    transactions.push({
      id: `syn-${i}`,
      date: date.toISOString().slice(0, 10),
      amount: i % 6 === 5 ? 2400 : -(10 + (i % 90)),
      payee: PAYEES[i % PAYEES.length],
      description: '',
      original_text: '',
      auto_mapped: false,
      confirmed: true,
    });
  }
  return transactions;
}
