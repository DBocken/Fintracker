import { format, parseISO } from 'date-fns';
import { resolveDateFnsLocale } from '@/i18n/date-fns-locale';
import type { Transaction } from '@/types';
import type { BalanceHistoryPoint, DashboardGranularity, IncomeExpensePoint } from './overview-types';

// Kanonische Quelle: src/features/shared/domain/flow-calculations.ts (≥2 Slices benötigen diese Logik).
export { computeFlowTotals } from '@/features/shared/domain/flow-calculations';

/**
 * Zeitreihe Einnahmen/Ausgaben je Granularitäts-Bucket. Die Bucket-Reihenfolge
 * folgt dem ersten Vorkommen in `visibleTransactions` (kein Sortieren) —
 * identisch zur bisherigen Inline-Berechnung in Dashboard.tsx.
 */
export function buildIncomeExpenseSeries(
  visibleTransactions: Transaction[],
  granularity: DashboardGranularity
): IncomeExpensePoint[] {
  const flowTransactions = visibleTransactions.filter((t) => !t.is_transfer);

  const seriesObj = flowTransactions.reduce((acc, t) => {
    const date = format(
      parseISO(t.date),
      granularity === 'daily' ? 'dd.MM.' : granularity === 'weekly' ? 'dd.MM.' : 'MM.yy',
      { locale: resolveDateFnsLocale() }
    );
    if (!acc[date]) acc[date] = { income: 0, expenses: 0 };
    if (t.amount > 0) acc[date].income += t.amount;
    else acc[date].expenses += Math.abs(t.amount);
    return acc;
  }, {} as Record<string, { income: number; expenses: number }>);

  return Object.entries(seriesObj).map(([date, data]) => ({ date, ...data }));
}

/** Summe aller Transaktionsbeträge (inkl. Transfers) — Gesamtfluss für die Saldo-Rückrechnung. */
export function computeTotalFlow(transactions: Transaction[]): number {
  return transactions.reduce((sum, tx) => sum + tx.amount, 0);
}

/** Rechnet den Startsaldo aus dem heutigen Kontostand minus dem Gesamtfluss zurück. */
export function computeAutoStartingBalance(endBalanceFromAccounts: number, totalFlow: number): number {
  const computed = endBalanceFromAccounts - totalFlow;
  return Number.isFinite(computed) ? computed : 0;
}

/**
 * Tägliche Saldo-Historie ab `startingBalance`: aufsteigend sortiert, mit
 * laufendem kumulativem Saldo. Sortiert eine Kopie (nicht die Eingabe), damit
 * Aufrufer ihre Transaktionsliste unverändert weiterverwenden können.
 */
export function buildBalanceHistory(transactions: Transaction[], startingBalance: number): BalanceHistoryPoint[] {
  if (!transactions.length) return [];

  const sortedTxs = [...transactions].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

  const dailyMap = new Map<string, BalanceHistoryPoint>();
  let currentBalance = startingBalance;

  sortedTxs.forEach((tx) => {
    const isoKey = format(parseISO(tx.date), 'yyyy-MM-dd');
    const label = format(parseISO(tx.date), 'dd.MM', { locale: resolveDateFnsLocale() });

    if (!dailyMap.has(isoKey)) {
      dailyMap.set(isoKey, {
        iso: isoKey,
        label,
        income: 0,
        expenses: 0,
        balance: 0,
        cumulative: currentBalance,
      });
    }

    const day = dailyMap.get(isoKey)!;

    if (tx.amount > 0) {
      day.income += tx.amount;
    } else {
      day.expenses += Math.abs(tx.amount);
    }

    day.balance += tx.amount;
    currentBalance += tx.amount;
    day.cumulative = currentBalance;
  });

  return Array.from(dailyMap.values()).sort((a, b) => a.iso.localeCompare(b.iso));
}
