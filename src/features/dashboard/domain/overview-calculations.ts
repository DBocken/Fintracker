import { format, parseISO } from 'date-fns';
import { resolveDateFnsLocale } from '@/i18n/date-fns-locale';
import type { Transaction } from '@/types';
import type { BalanceHistoryPoint, DashboardGranularity, IncomeExpensePoint } from './overview-types';

// Kanonische Quelle: src/features/shared/domain/flow-calculations.ts (≥2 Slices benötigen diese Logik).
export { computeFlowTotals } from '@/features/shared/domain/flow-calculations';

/**
 * Zeitreihe Einnahmen/Ausgaben je Granularitäts-Bucket, **chronologisch
 * aufsteigend**.
 *
 * Bis hierher folgte die Reihenfolge dem ersten Vorkommen in
 * `visibleTransactions` — „identisch zur bisherigen Inline-Berechnung in
 * Dashboard.tsx", also übernommen und nie entschieden. Die Buchungsliste ist
 * datum-ABSTEIGEND sortiert, und damit lief die Zeitachse jedes Diagramms, das
 * diese Reihe zeichnet, von rechts nach links. Am Gerät aufgenommen stand
 * unter dem Verlauf `01.26 · 12.25 · 11.25`: eine steigende Kurve, die in
 * Wahrheit fällt. Kein Test wurde rot — einer hielt die Reihenfolge sogar
 * ausdrücklich fest.
 *
 * **Sortiert wird über einen echten Zeitstempel, nicht über die Beschriftung.**
 * `dd.MM.` trägt gar kein Jahr und `MM.yy` sortiert lexikalisch falsch
 * (`01.26` vor `12.25`); der Schlüssel ist deshalb der früheste Zeitpunkt im
 * Bucket, und er verlässt die Funktion nicht.
 */
export function buildIncomeExpenseSeries(
  visibleTransactions: Transaction[],
  granularity: DashboardGranularity
): IncomeExpensePoint[] {
  const flowTransactions = visibleTransactions.filter((t) => !t.is_transfer);

  const buckets = new Map<string, { income: number; expenses: number; zeitpunkt: number }>();

  for (const t of flowTransactions) {
    const zeitpunkt = parseISO(t.date);
    const date = format(
      zeitpunkt,
      granularity === 'daily' ? 'dd.MM.' : granularity === 'weekly' ? 'dd.MM.' : 'MM.yy',
      { locale: resolveDateFnsLocale() }
    );
    const bucket = buckets.get(date) ?? {
      income: 0,
      expenses: 0,
      zeitpunkt: Number.POSITIVE_INFINITY,
    };
    if (t.amount > 0) bucket.income += t.amount;
    else bucket.expenses += Math.abs(t.amount);
    bucket.zeitpunkt = Math.min(bucket.zeitpunkt, zeitpunkt.getTime());
    buckets.set(date, bucket);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[1].zeitpunkt - b[1].zeitpunkt)
    .map(([date, { income, expenses }]) => ({ date, income, expenses }));
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
