import { describe, it, expect, beforeEach } from 'vitest';
import { getWaterfallPlan } from '../waterfall-service';
import { saveTransactions } from '../transaction-service';
import { transactionStorage } from '../transaction-storage-service';
import { writeLocalFinanceList } from '../local-finance-store';
import { updateLocalUserSettings } from '../local-settings-service';
import { localEncryption } from '../local-crypto';
import type { Account, Transaction } from '../../types';

const REFERENCE = new Date('2025-06-15T12:00:00Z');

function account(id: string, isBusiness: boolean): Account {
  return {
    id,
    user_id: 'local',
    name: id,
    type: 'checking',
    currency: 'EUR',
    color: '#111',
    icon: '🏦',
    is_budget_pool_member: true,
    is_business: isBusiness,
    order_index: 0,
  };
}

let seq = 0;
function tx(overrides: Partial<Transaction>): Transaction {
  seq += 1;
  return {
    id: `wf-${seq}`,
    account_id: 'biz',
    date: '2025-05-10',
    amount: 1000,
    payee: 'Kunde',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...overrides,
  };
}

/** Zwei Monate Betriebseinnahmen à 1.000 € auf dem Geschäftskonto. */
async function seedBusinessIncome(): Promise<void> {
  await saveTransactions([
    tx({ date: '2025-04-10', amount: 1000 }),
    tx({ date: '2025-05-10', amount: 1000 }),
  ]);
}

beforeEach(async () => {
  localStorage.clear();
  localEncryption.lock();
  localStorage.setItem('ausgabentracker_locale_v1', 'de');
  await transactionStorage.clearLocalCache();
  await writeLocalFinanceList('accounts', [account('biz', true), account('priv', false)]);
});

describe('getWaterfallPlan — Gating der Steuer-Stufe', () => {
  it('[REGRESSION] sollte ohne business_mode KEINE Steuer-Stufe emittieren (Default)', async () => {
    await seedBusinessIncome();

    const plan = await getWaterfallPlan(undefined, REFERENCE);

    expect(plan.steps.some((s) => s.key === 'tax-reserve')).toBe(false);
  });

  it('sollte im Business-Modus Median-Betriebseinnahmen × Rücklage-% dotieren', async () => {
    await seedBusinessIncome();
    await updateLocalUserSettings({ business_mode: true, tax_reserve_percent: 30 });

    const plan = await getWaterfallPlan(undefined, REFERENCE);

    const taxStep = plan.steps.find((s) => s.key === 'tax-reserve');
    // Median(1.000, 1.000) × 30 % = 300
    expect(taxStep?.requested).toBe(300);
    expect(plan.steps[0]?.key).toBe('tax-reserve');
  });

  it('sollte bei Prozent 0 keine Stufe emittieren (Feature aus)', async () => {
    await seedBusinessIncome();
    await updateLocalUserSettings({ business_mode: true, tax_reserve_percent: 0 });

    const plan = await getWaterfallPlan(undefined, REFERENCE);

    expect(plan.steps.some((s) => s.key === 'tax-reserve')).toBe(false);
  });

  it('sollte ohne Betriebseinnahmen keine Stufe emittieren', async () => {
    await updateLocalUserSettings({ business_mode: true, tax_reserve_percent: 30 });
    // Nur private Einnahmen (kein Geschäftskonto, keine EÜR-Markierung).
    await saveTransactions([tx({ account_id: 'priv', date: '2025-05-10', amount: 2000 })]);

    const plan = await getWaterfallPlan(undefined, REFERENCE);

    expect(plan.steps.some((s) => s.key === 'tax-reserve')).toBe(false);
  });
});
