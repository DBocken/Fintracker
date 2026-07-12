import { describe, it, expect } from 'vitest';
import { dashboardKeys, DASHBOARD_TRANSACTION_LIMIT } from '../dashboard-query-keys';

describe('dashboard-query-keys', () => {
  it('sollte byte-identische Keys zu den bisherigen Inline-Literalen liefern', () => {
    expect(dashboardKeys.transactionsRoot).toEqual(['transactions']);
    expect(dashboardKeys.transactions(5000)).toEqual(['transactions', 5000]);
    expect(dashboardKeys.categories).toEqual(['categories']);
    expect(dashboardKeys.accounts).toEqual(['accounts']);
    expect(dashboardKeys.contractDecisions).toEqual(['contract-decisions']);
  });

  it('[REGRESSION] sollte das Dashboard-Limit 5000 beibehalten (F-PERF-3)', () => {
    expect(DASHBOARD_TRANSACTION_LIMIT).toBe(5000);
    expect(dashboardKeys.transactions(DASHBOARD_TRANSACTION_LIMIT)).toEqual(['transactions', 5000]);
  });
});
