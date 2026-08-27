/**
 * Fortschreibung der Vermögens-Historie (Welle 4).
 *
 * I/O-Schicht; Form und Auswahl liegen in `lib/net-worth-history-types.ts`.
 * Die Collection ist in `LOCAL_FINANCE_KEYS` registriert und damit
 * verschlüsselt und im Backup.
 */

import type { NetWorthBreakdown } from '@/lib/net-worth-types';
import type { NetWorthSnapshot } from '@/lib/net-worth-history-types';
import { fortschreiben, monatsSchluessel } from '@/lib/net-worth-history-types';
import { mutateLocalFinanceList, readLocalFinanceList } from './local-finance-store';

export async function getNetWorthHistory(): Promise<NetWorthSnapshot[]> {
  const bestand = await readLocalFinanceList<NetWorthSnapshot>('netWorthHistory');
  return [...bestand].sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Den aktuellen Stand als Schnappschuss des laufenden Monats ablegen.
 *
 * Über `mutateLocalFinanceList`, weil zwischen Lesen und Schreiben ein echtes
 * `await` liegt (AGENTS.md §2): Zwei gleichzeitige Aufrufe — etwa aus zwei
 * offenen Tabs — läsen denselben Bestand, und der zweite schriebe eine
 * Fassung ohne den ersten. Bei einer Zeitreihe hiesse das einen fehlenden
 * Monat, und der fällt niemandem auf.
 */
export async function schreibeSchnappschuss(
  aufstellung: NetWorthBreakdown,
  jetzt: Date = new Date(),
): Promise<void> {
  const neuer: NetWorthSnapshot = {
    month: monatsSchluessel(jetzt),
    takenAt: jetzt.toISOString().slice(0, 10),
    netWorth: aufstellung.netWorth,
    cash: aufstellung.cash,
    investments: aufstellung.investments,
    manualAssets: aufstellung.manualAssets,
    receivables: aufstellung.receivables,
    debts: aufstellung.debts,
  };

  await mutateLocalFinanceList<NetWorthSnapshot>('netWorthHistory', (bestand) =>
    fortschreiben(bestand, neuer),
  );
}
