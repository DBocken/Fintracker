import { describe, it, expect } from 'vitest';
import { financeKeys, FINANCE_TRANSACTION_LIMIT } from '../finance-query-keys';

describe('finance-query-keys', () => {
  it('sollte byte-identische Keys zu den historischen Inline-Literalen liefern', () => {
    expect(financeKeys.transactionsRoot).toEqual(['transactions']);
    expect(financeKeys.transactions(5000)).toEqual(['transactions', 5000]);
    expect(financeKeys.categories).toEqual(['categories']);
    expect(financeKeys.accounts).toEqual(['accounts']);
    expect(financeKeys.contractDecisions).toEqual(['contract-decisions']);
  });

  it('[REGRESSION] sollte das Transaktions-Limit 5000 beibehalten (F-PERF-3)', () => {
    expect(FINANCE_TRANSACTION_LIMIT).toBe(5000);
    expect(financeKeys.transactions(FINANCE_TRANSACTION_LIMIT)).toEqual(['transactions', 5000]);
  });
});
