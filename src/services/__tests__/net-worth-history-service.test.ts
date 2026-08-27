import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NetWorthBreakdown } from '@/lib/net-worth-types';
import type { NetWorthSnapshot } from '@/lib/net-worth-history-types';

const readLocalFinanceList = vi.fn();
const mutateLocalFinanceList = vi.fn();

vi.mock('@/services/local-finance-store', () => ({
  readLocalFinanceList: (k: string) => readLocalFinanceList(k),
  mutateLocalFinanceList: (k: string, f: (i: unknown[]) => unknown[]) =>
    mutateLocalFinanceList(k, f),
}));

import { getNetWorthHistory, schreibeSchnappschuss } from '../net-worth-history-service';

const AUFSTELLUNG: NetWorthBreakdown = {
  cash: 1000,
  investments: 500,
  manualAssets: 15000,
  receivables: 0,
  debts: 4000,
  netWorth: 12500,
  accountBalances: {},
  accountSources: [],
  portfolioSources: [],
  unconvertedInvestments: [],
  debtSources: [],
  receivableSources: [],
  manualAssetSources: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  readLocalFinanceList.mockResolvedValue([]);
  mutateLocalFinanceList.mockResolvedValue(undefined);
});

describe('Vermögens-Historie (Dienst)', () => {
  it('sollte den Stand als Monatsschnappschuss ablegen', async () => {
    await schreibeSchnappschuss(AUFSTELLUNG, new Date('2026-08-27T10:00:00Z'));

    expect(mutateLocalFinanceList).toHaveBeenCalledWith('netWorthHistory', expect.any(Function));
    const fortschreiben = mutateLocalFinanceList.mock.calls[0][1] as (
      b: NetWorthSnapshot[],
    ) => NetWorthSnapshot[];
    const bestand = fortschreiben([]);
    expect(bestand).toHaveLength(1);
    expect(bestand[0]).toMatchObject({
      month: '2026-08',
      takenAt: '2026-08-27',
      netWorth: 12500,
      manualAssets: 15000,
    });
  });

  it('[REGRESSION] sollte serialisiert schreiben, nicht lesen-ändern-schreiben', async () => {
    // Zwischen Lesen und Schreiben liegt ein echtes `await` (AGENTS.md §2).
    // Zwei offene Tabs läsen sonst denselben Bestand, und der zweite schriebe
    // eine Fassung ohne den ersten — bei einer Zeitreihe hiesse das ein
    // fehlender Monat, und der fällt niemandem auf.
    await schreibeSchnappschuss(AUFSTELLUNG, new Date('2026-08-27T10:00:00Z'));
    expect(readLocalFinanceList).not.toHaveBeenCalled();
    expect(mutateLocalFinanceList).toHaveBeenCalledTimes(1);
  });

  it('sollte je Monat nur einen Punkt führen', async () => {
    await schreibeSchnappschuss(AUFSTELLUNG, new Date('2026-08-28T10:00:00Z'));
    const fortschreiben = mutateLocalFinanceList.mock.calls[0][1] as (
      b: NetWorthSnapshot[],
    ) => NetWorthSnapshot[];
    const bestand = fortschreiben([
      { month: '2026-08', takenAt: '2026-08-03', netWorth: 9000, cash: 9000, investments: 0, manualAssets: 0, receivables: 0, debts: 0 },
    ]);
    expect(bestand).toHaveLength(1);
    expect(bestand[0].netWorth).toBe(12500);
  });

  it('sollte die Historie chronologisch liefern', async () => {
    readLocalFinanceList.mockResolvedValue([
      { month: '2026-08', takenAt: '2026-08-15', netWorth: 2, cash: 0, investments: 0, manualAssets: 0, receivables: 0, debts: 0 },
      { month: '2026-02', takenAt: '2026-02-15', netWorth: 1, cash: 0, investments: 0, manualAssets: 0, receivables: 0, debts: 0 },
    ]);
    const historie = await getNetWorthHistory();
    expect(historie.map((s) => s.month)).toEqual(['2026-02', '2026-08']);
  });
});
