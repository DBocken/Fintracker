import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Category, Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';

/**
 * WP-10.5 — Die aggregierte Ausgaben-Auswertung, bis hierher ohne einen
 * einzigen Test.
 *
 * Zur Einordnung, weil der Name in die Irre führen kann: Das ist **nicht** der
 * Telemetrie-Versand. `decision-log` F-1 hält ausdrücklich fest, dass Beträge
 * das Gerät nicht verlassen — `uploadEncryptedAnalyticsPackage` wirft
 * entsprechend. Was hier entsteht, bleibt lokal.
 *
 * Getestet wird es trotzdem, und zwar aus zwei Gründen: Die Summen liefen über
 * Float-Euro mit `toFixed` statt über Integer-Cent (AGENTS.md §8), und der
 * Schutz vor zu kleinen Gruppen war nirgends festgeschrieben.
 */

vi.mock('../transaction-service', () => ({
  getTransactions: vi.fn(),
  getCategories: vi.fn(),
}));

import { getTransactions, getCategories } from '../transaction-service';
import { buildAnalyticsPackage } from '../analytics-aggregation-service';

const CATEGORY: Category = {
  id: 'cat-food',
  name: 'Lebensmittel',
  attributes: {},
} as Category;

function tx(amount: number, date = '2026-01-10', id = Math.random().toString(36)): Transaction {
  return { id: asTransactionId(id), amount, date, category_id: 'cat-food' } as Transaction;
}

function withData(transactions: Transaction[], categories: Category[] = [CATEGORY]) {
  vi.mocked(getTransactions).mockResolvedValue(transactions);
  vi.mocked(getCategories).mockResolvedValue(categories);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildAnalyticsPackage — Beträge', () => {
  it('[REGRESSION] sollte in Cent summieren statt Float-Drift wegzurunden', async () => {
    // Drei Beträge, deren Float-Summe nicht exakt ist: 0.1 + 0.2 + 0.3
    // ergibt in JavaScript 0.6000000000000001. Fünf Buchungen, damit die
    // k-Anonymitäts-Schwelle nicht greift.
    withData([tx(-0.1), tx(-0.2), tx(-0.3), tx(-0.1), tx(-0.3)]);

    const pkg = await buildAnalyticsPackage();

    // 10 + 20 + 30 + 10 + 30 Cent = 100 Cent
    expect(pkg.records[0].measures.expense_sum).toBe(1);
  });

  it('sollte den Durchschnitt auf ganze Cent runden', async () => {
    // 100 Cent auf 3 Buchungen sind 33,333… — der Wert muss ein sauberer
    // Cent-Betrag sein, nicht eine Zahl mit sechzehn Nachkommastellen.
    withData([tx(-0.5), tx(-0.3), tx(-0.2), tx(-0.5), tx(-0.5)]);

    const { expense_average: average } = (await buildAnalyticsPackage()).records[0].measures;

    expect(Number.isInteger(Math.round(average * 100))).toBe(true);
    expect(average).toBeCloseTo(0.4, 10);
  });

  it('sollte Einnahmen ignorieren', async () => {
    withData([tx(-1), tx(-1), tx(-1), tx(-1), tx(-1), tx(500)]);

    const pkg = await buildAnalyticsPackage();

    expect(pkg.records[0].measures.transaction_count).toBe(5);
    expect(pkg.records[0].measures.expense_sum).toBe(5);
  });

  it('sollte den Anteil aus den Cent-Summen bilden', async () => {
    // Zwei Gruppen zu je fünf Buchungen: 5 € und 15 € → 25 % und 75 %.
    const other = { ...CATEGORY, id: 'cat-home', name: 'Wohnen Miete' } as Category;
    withData(
      [
        ...Array.from({ length: 5 }, () => tx(-1)),
        ...Array.from({ length: 5 }, (_, i) => ({ ...tx(-3), id: asTransactionId(`h${i}`), category_id: 'cat-home' })),
      ],
      [CATEGORY, other],
    );

    const shares = (await buildAnalyticsPackage()).records.map((r) => r.measures.category_share_of_expenses);

    expect(shares.sort()).toEqual([0.25, 0.75]);
  });
});

describe('buildAnalyticsPackage — Schutz kleiner Gruppen', () => {
  it('[SECURITY] sollte Gruppen unter der Mindestgröße gar nicht erst melden', async () => {
    // Vier Buchungen — eine weniger als die Schwelle. Ein einzelner Datensatz
    // über eine sehr kleine Gruppe ist der Punkt, an dem Aggregation aufhört,
    // Aggregation zu sein.
    withData([tx(-1), tx(-2), tx(-3), tx(-4)]);

    const pkg = await buildAnalyticsPackage();

    expect(pkg.records).toEqual([]);
    expect(pkg.suppressed_records).toBe(1);
    expect(pkg.protections.minimum_local_events).toBe(5);
  });

  it('[PRIVACY] sollte keine Rohdaten und keine Kategorienamen mitgeben', async () => {
    withData(Array.from({ length: 5 }, () => tx(-1)));

    const pkg = await buildAnalyticsPackage();
    const serialised = JSON.stringify(pkg);

    expect(pkg.protections.raw_transactions_uploaded).toBe(false);
    expect(pkg.protections.direct_identifiers_removed).toBe(true);
    // Die Gruppe wird über eine feste Kennung gemeldet, nicht über den vom
    // Nutzer vergebenen Namen (AGENTS.md: nie über den Anzeigenamen matchen).
    expect(pkg.records[0].dimensions.category_group).toBe('lebensmittel');
    expect(serialised).not.toContain('Lebensmittel');
    // Kein Datum einer einzelnen Buchung, nur der Monat.
    expect(serialised).not.toContain('2026-01-10');
    expect(pkg.records[0].period).toBe('2026-01');
  });
});

describe('buildAnalyticsPackage — Gruppierung', () => {
  it('sollte je Monat und Gruppe einen Datensatz bilden', async () => {
    withData([
      ...Array.from({ length: 5 }, (_, i) => ({ ...tx(-1, '2026-01-05'), id: asTransactionId(`a${i}`) })),
      ...Array.from({ length: 5 }, (_, i) => ({ ...tx(-1, '2026-02-05'), id: asTransactionId(`b${i}`) })),
    ]);

    const periods = (await buildAnalyticsPackage()).records.map((r) => r.period).sort();

    expect(periods).toEqual(['2026-01', '2026-02']);
  });
});
