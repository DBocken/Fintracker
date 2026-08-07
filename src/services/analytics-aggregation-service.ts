import type { Category, Transaction } from '@/types';
import { getCategories, getTransactions } from './transaction-service';
import { sumMinor, toMajor, toMinor } from '@/lib/money';

export type AnalyticsAggregationRecord = {
  schema_version: 1;
  period: string;
  dimensions: {
    category_group: string;
    age_bucket?: string;
    income_bucket?: string;
    household_size_bucket?: string;
  };
  measures: {
    expense_sum: number;
    expense_average: number;
    transaction_count: number;
    category_share_of_expenses: number;
  };
  cohort_size: number;
  generated_at: string;
};

export type AnalyticsPackageV1 = {
  schema_version: 1;
  generated_at: string;
  records: AnalyticsAggregationRecord[];
  suppressed_records: number;
  protections: {
    raw_transactions_uploaded: false;
    direct_identifiers_removed: true;
    minimum_local_events: number;
    exact_text_removed: true;
  };
};

const MIN_LOCAL_EVENTS = 5;

function monthOf(date: string): string {
  return (date || new Date().toISOString()).slice(0, 7);
}

function mapCategoryGroup(category?: Category): string {
  const name = `${category?.name || ''} ${(category?.attributes?.tags ?? []).join(' ')}`.toLowerCase();
  if (/lebensmittel|supermarkt|essen|food|grocery|restaurant/.test(name)) return 'lebensmittel';
  if (/wohnen|miete|strom|gas|energie|nebenkosten/.test(name)) return 'wohnen';
  if (/mobil|auto|bahn|transport|tanken|flug/.test(name)) return 'mobilitaet';
  if (/versicherung|gesund|arzt|apotheke/.test(name)) return 'gesundheit_absicherung';
  if (/freizeit|reise|urlaub|hobby|sport/.test(name)) return 'freizeit';
  if (/einkommen|gehalt|lohn/.test(name)) return 'einkommen';
  return 'sonstiges';
}

export async function buildAnalyticsPackage(): Promise<AnalyticsPackageV1> {
  const [transactions, categories] = await Promise.all([getTransactions(10000), getCategories()]);
  const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));
  const expenses = transactions.filter((tx) => Number(tx.amount) < 0);
  // AGENTS.md §8: Aggregation in Integer-Cent, nicht in Float-Euro. Vorher
  // summierte diese Funktion Floats und rundete das Ergebnis mit `toFixed(2)`
  // zurecht — die Rundung versteckt den Fehler, sie behebt ihn nicht. Bei 500
  // Buchungen liegt die Drift zuverlaessig im Cent-Bereich, und diese Zahlen
  // gehen als Kennzahlen aus dem Haus (Phase 11).
  const totalExpensesMinor = sumMinor(expenses.map((tx) => Math.abs(toMinor(Number(tx.amount) || 0))));
  const buckets = new Map<string, Transaction[]>();

  for (const tx of expenses) {
    const categoryGroup = mapCategoryGroup(tx.category_id ? categoryMap.get(tx.category_id) : undefined);
    const period = monthOf(tx.date);
    const key = `${period}|${categoryGroup}`;
    buckets.set(key, [...(buckets.get(key) || []), tx]);
  }

  const generatedAt = new Date().toISOString();
  const records: AnalyticsAggregationRecord[] = [];
  let suppressedRecords = 0;

  for (const [key, rows] of buckets) {
    if (rows.length < MIN_LOCAL_EVENTS) {
      suppressedRecords += 1;
      continue;
    }

    const [period, categoryGroup] = key.split('|');
    const expenseSumMinor = sumMinor(rows.map((tx) => Math.abs(toMinor(Number(tx.amount) || 0))));
    records.push({
      schema_version: 1,
      period,
      dimensions: { category_group: categoryGroup },
      measures: {
        // `toMajor` ist der Uebergang zur Anzeige-/Exportform — hier endet die
        // Cent-Rechnung, sie beginnt nicht erst danach.
        expense_sum: toMajor(expenseSumMinor),
        expense_average: toMajor(Math.round(expenseSumMinor / rows.length)),
        transaction_count: rows.length,
        // Ein Anteil ist kein Geldbetrag: Er wird aus den Cent-Summen
        // gebildet (exakt) und erst zur Ausgabe auf vier Stellen gekuerzt.
        category_share_of_expenses:
          totalExpensesMinor > 0 ? Number((expenseSumMinor / totalExpensesMinor).toFixed(4)) : 0,
      },
      cohort_size: rows.length,
      generated_at: generatedAt,
    });
  }

  return {
    schema_version: 1,
    generated_at: generatedAt,
    records,
    suppressed_records: suppressedRecords,
    protections: {
      raw_transactions_uploaded: false,
      direct_identifiers_removed: true,
      minimum_local_events: MIN_LOCAL_EVENTS,
      exact_text_removed: true,
    },
  };
}

export async function uploadEncryptedAnalyticsPackage(): Promise<{ uploaded: number; suppressed: number }> {
  throw new Error('Analytics-Upload ist deaktiviert: Finanz- und Nutzungsdaten bleiben ausschließlich lokal.');
}
