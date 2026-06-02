"use client";

import { supabase } from '@/integrations/supabase/client';
import type { Category, Transaction } from '@/types';
import { requireUserId } from './auth-service';
import { localEncryption } from './local-crypto';
import { getAnalyticsConsent } from './analytics-consent-service';
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
  const name = `${category?.name || ''} ${(category?.attributes as any)?.tags?.join(' ') || ''}`.toLowerCase();
  if (/lebensmittel|supermarkt|essen|food|grocery|restaurant/.test(name)) return 'lebensmittel';
  if (/wohnen|miete|strom|gas|energie|nebenkosten/.test(name)) return 'wohnen';
  if (/mobil|auto|bahn|transport|tanken|flug/.test(name)) return 'mobilitaet';
  if (/versicherung|gesund|arzt|apotheke/.test(name)) return 'gesundheit_absicherung';
  if (/freizeit|reise|urlaub|hobby|sport/.test(name)) return 'freizeit';
  if (/einkommen|gehalt|lohn/.test(name)) return 'einkommen';
  return 'sonstiges';
}

async function hashDimensions(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
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
  const consent = await getAnalyticsConsent();
  if (!consent.opted_in) {
    throw new Error('Anonyme Auswertung ist nicht aktiviert.');
  }
  if (!localEncryption.isEnabled() || !localEncryption.isUnlocked()) {
    throw new Error('Bitte lokale Verschlüsselung entsperren.');
  }

  const userId = await requireUserId();
  const pkg = await buildAnalyticsPackage();
  if (pkg.records.length === 0) {
    return { uploaded: 0, suppressed: pkg.suppressed_records };
  }

  for (const record of pkg.records) {
    const payload = await localEncryption.encryptJson({ ...pkg, records: [record] });
    const dimensionsHash = await hashDimensions(record.dimensions);
    const { error } = await supabase.from('encrypted_analytics_blobs').insert({
      user_id: userId,
      schema_version: record.schema_version,
      blob_type: 'local-aggregate',
      period: record.period,
      cohort_size: record.cohort_size,
      dimensions_hash: dimensionsHash,
      payload,
    });
    if (error) throw new Error(error.message);
  }

  localStorage.setItem('ausgabentracker_analytics_last_generated_at_v1', pkg.generated_at);
  return { uploaded: pkg.records.length, suppressed: pkg.suppressed_records };
}
