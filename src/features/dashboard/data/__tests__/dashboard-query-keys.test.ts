import { describe, it, expect } from 'vitest';
import { dashboardKeys } from '../dashboard-query-keys';

describe('dashboard-query-keys', () => {
  it('sollte byte-identische Keys zu den bisherigen Inline-Literalen liefern', () => {
    expect(dashboardKeys.transactionsRoot).toEqual(['transactions']);
    expect(dashboardKeys.transactionsAll).toEqual(['transactions', 'all']);
    expect(dashboardKeys.categories).toEqual(['categories']);
    expect(dashboardKeys.accounts).toEqual(['accounts']);
    expect(dashboardKeys.contractDecisions).toEqual(['contract-decisions']);
  });

  it('[REGRESSION] sollte denselben Bestands-Key wie die Shared-Schicht liefern', () => {
    // GEÄNDERTE ERWARTUNG (Audit 2026-09, F2): Hier stand „sollte das
    // Dashboard-Limit 5000 beibehalten" — festgehalten wurde damit die
    // Kappung, auf der das Dashboard seine Summen rechnete.
    expect(dashboardKeys.transactionsAll).toEqual(['transactions', 'all']);
  });
});
