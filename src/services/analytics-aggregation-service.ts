import type { Category, Transaction } from '@/types';
import { getCategories, getTransactions } from './transaction-service';

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
  const totalExpenses = expenses.reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0);
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
    const expenseSum = rows.reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0);
    records.push({
      schema_version: 1,
      period,
      dimensions: { category_group: categoryGroup },
      measures: {
        expense_sum: Number(expenseSum.toFixed(2)),
        expense_average: Number((expenseSum / rows.length).toFixed(2)),
        transaction_count: rows.length,
        category_share_of_expenses: totalExpenses > 0 ? Number((expenseSum / totalExpenses).toFixed(4)) : 0,
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
