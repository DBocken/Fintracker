import { describe, it, expect } from 'vitest';
import {
  computeLocalBalances,
  computeEffectiveBalances,
  computeTotalEffectiveBalance,
} from '../balance-calculations';
import { computeFlowTotals } from '../flow-calculations';
import { financeKeys, FINANCE_TRANSACTION_LIMIT } from '../../data/finance-query-keys';
import {
  computeLocalBalances as dashboardLocalBalances,
  computeEffectiveBalances as dashboardEffectiveBalances,
  computeTotalEffectiveBalance as dashboardTotalEffectiveBalance,
} from '@/features/dashboard/domain/balance-calculations';
import { computeFlowTotals as dashboardFlowTotals } from '@/features/dashboard/domain/overview-calculations';
import {
  dashboardKeys,
  DASHBOARD_TRANSACTION_LIMIT,
} from '@/features/dashboard/data/dashboard-query-keys';

describe('shared Re-Export-Integrität', () => {
  it('[REGRESSION] sollte identische Funktionsreferenzen über die Dashboard-Re-Exports liefern', () => {
    expect(Object.is(computeLocalBalances, dashboardLocalBalances)).toBe(true);
    expect(Object.is(computeEffectiveBalances, dashboardEffectiveBalances)).toBe(true);
    expect(Object.is(computeTotalEffectiveBalance, dashboardTotalEffectiveBalance)).toBe(true);
    expect(Object.is(computeFlowTotals, dashboardFlowTotals)).toBe(true);
  });

  it('[REGRESSION] sollte dashboardKeys als dasselbe Objekt wie financeKeys bereitstellen', () => {
    expect(Object.is(dashboardKeys, financeKeys)).toBe(true);
    expect(DASHBOARD_TRANSACTION_LIMIT).toBe(FINANCE_TRANSACTION_LIMIT);
  });
});
