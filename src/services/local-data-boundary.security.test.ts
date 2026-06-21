import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const LOCAL_ONLY_SERVICES = [
  'contract-decision-service.ts',
  'transaction-allocation-service.ts',
  'transaction-service.ts',
  'category-service.ts',
  'merchant-rules-service.ts',
  'user-settings-service.ts',
  'category-priority-service.ts',
  'milestones-service.ts',
  'analytics-consent-service.ts',
  'analytics-aggregation-service.ts',
  'snapshot-sync-service.ts',
  'backup-service.ts',
] as const;

describe('[PRIVACY] lokale Finanzdaten-Grenze', () => {
  it.each(LOCAL_ONLY_SERVICES)('%s besitzt keinen Supabase-Datenpfad', (fileName) => {
    const source = readFileSync(new URL(fileName, import.meta.url), 'utf8');

    expect(source).not.toMatch(/integrations\/supabase|\bsupabase\b/i);
    expect(source).not.toMatch(/user_contract_decisions|user_transaction_allocations/);
  });
});
