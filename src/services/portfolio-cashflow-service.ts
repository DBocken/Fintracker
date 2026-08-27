/**
 * Ein- und Auszahlungen je Depot (Welle 4).
 *
 * I/O-Schicht; die Form liegt in `lib/portfolio-types.ts`, die Rechnung in
 * `lib/money-weighted-return.ts`. Die Collection ist in
 * `LOCAL_FINANCE_KEYS` registriert und damit verschlüsselt und im Backup.
 */

import type { PortfolioCashflow } from '@/lib/portfolio-types';
import {
  deleteLocalFinanceItem,
  readLocalFinanceList,
  upsertLocalFinanceItem,
} from './local-finance-store';

export async function getPortfolioCashflows(portfolioId?: string): Promise<PortfolioCashflow[]> {
  const alle = await readLocalFinanceList<PortfolioCashflow>('portfolioCashflows');
  const gefiltert = portfolioId ? alle.filter((c) => c.portfolio_id === portfolioId) : alle;
  return gefiltert.sort((a, b) => a.date.localeCompare(b.date));
}

export async function upsertPortfolioCashflow(
  cashflow: Partial<PortfolioCashflow> & { portfolio_id: string },
): Promise<PortfolioCashflow> {
  const now = new Date().toISOString();
  return upsertLocalFinanceItem<PortfolioCashflow>('portfolioCashflows', {
    id: cashflow.id || crypto.randomUUID(),
    portfolio_id: cashflow.portfolio_id,
    date: cashflow.date || now.slice(0, 10),
    // Betrag immer positiv ablegen — die Richtung trägt `direction`.
    amount: Math.abs(cashflow.amount ?? 0),
    direction: cashflow.direction || 'deposit',
    note: cashflow.note ?? null,
    created_at: cashflow.created_at ?? now,
    updated_at: now,
  });
}

export async function deletePortfolioCashflow(id: string): Promise<void> {
  await deleteLocalFinanceItem('portfolioCashflows', id);
}
