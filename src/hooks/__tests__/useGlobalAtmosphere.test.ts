/**
 * Tests für den globalen Atmosphäre-Hook.
 *
 * Kern der Prüfung ist nicht nur die Ableitung (die deckt
 * `useAtmosphereState.test.ts` ab), sondern die Datenbeschaffung: der Hook
 * liest ausschließlich MIT, was andere Seiten ohnehin geladen haben, und löst
 * selbst keine Query aus. Ohne diese Eigenschaft würde die AppShell auf jeder
 * Route bis zu 5000 Buchungen laden, um einen Hintergrund mit maximal 8 %
 * Deckkraft einzufärben — Performance ist laut Plan §11 nicht kompensierbar.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createHookWrapper } from '@/test-utils/render';
import { financeKeys } from '@/features/shared/data/finance-query-keys';
import type { Transaction, BudgetStatus } from '@/types';
import { useGlobalAtmosphere } from '../useGlobalAtmosphere';

const reduceMock = vi.fn(() => false);
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => reduceMock(),
}));

const getTransactionsSpy = vi.fn();
vi.mock('@/services/transaction-service', () => ({
  getAllTransactions: (...args: unknown[]) => getTransactionsSpy(...args),
}));

const getBudgetOverviewSpy = vi.fn();
vi.mock('@/services/budget-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/budget-service')>();
  return { ...actual, getBudgetOverview: (...args: unknown[]) => getBudgetOverviewSpy(...args) };
});

beforeEach(() => {
  reduceMock.mockReturnValue(false);
  getTransactionsSpy.mockReset();
  getBudgetOverviewSpy.mockReset();
});

/** Referenzdatum fixiert die "aktuelle" Periode — kein Bezug auf die Systemuhr. */
const REFERENCE = new Date('2026-03-15T12:00:00Z');

function tx(date: string, amount: number): Transaction {
  return {
    date,
    amount,
    payee: 'p',
    description: 'd',
    original_text: 'o',
    auto_mapped: false,
    confirmed: true,
  } as Transaction;
}

function budgetStatus(health: 'ok' | 'warn' | 'over'): BudgetStatus {
  return { health } as BudgetStatus;
}

describe('useGlobalAtmosphere', () => {
  it('sollte ohne Daten im Cache neutral bleiben', () => {
    const { wrapper } = createHookWrapper();
    const { result } = renderHook(() => useGlobalAtmosphere(REFERENCE), { wrapper });

    expect(result.current.temperature).toBe('neutral');
    expect(result.current.intensity).toBe(0);
    expect(result.current.pulse).toBe('steady');
  });

  it('[PERF] sollte selbst keine Query ausloesen, sondern nur mitlesen', () => {
    const { wrapper } = createHookWrapper();
    renderHook(() => useGlobalAtmosphere(REFERENCE), { wrapper });

    // Das ist die tragende Eigenschaft: die Shell rendert auf JEDER Route.
    expect(getTransactionsSpy).not.toHaveBeenCalled();
    expect(getBudgetOverviewSpy).not.toHaveBeenCalled();
  });

  it('sollte bei Ueberschuss ohne Budgetueberschreitung warm werden', () => {
    const { wrapper, queryClient } = createHookWrapper();
    queryClient.setQueryData(financeKeys.transactionsAll, [
      tx('2026-03-01', 3000),
      tx('2026-03-05', -1000),
    ]);

    const { result } = renderHook(() => useGlobalAtmosphere(REFERENCE), { wrapper });

    expect(result.current.temperature).toBe('warm');
    expect(result.current.intensity).toBeGreaterThan(0);
  });

  it('sollte bei Fehlbetrag kuehl werden', () => {
    const { wrapper, queryClient } = createHookWrapper();
    queryClient.setQueryData(financeKeys.transactionsAll, [
      tx('2026-03-01', 1000),
      tx('2026-03-05', -1800),
    ]);

    const { result } = renderHook(() => useGlobalAtmosphere(REFERENCE), { wrapper });

    expect(result.current.temperature).toBe('cool');
  });

  it('sollte nur Buchungen des laufenden Monats beruecksichtigen', () => {
    const { wrapper, queryClient } = createHookWrapper();
    queryClient.setQueryData(financeKeys.transactionsAll, [
      tx('2026-03-01', 1000),
      tx('2026-03-05', -1800),
      // Februar-Ueberschuss darf den Maerz-Fehlbetrag NICHT ausgleichen.
      tx('2026-02-01', 99999),
    ]);

    const { result } = renderHook(() => useGlobalAtmosphere(REFERENCE), { wrapper });

    expect(result.current.temperature).toBe('cool');
  });

  it('sollte ueberzogene Budgets aus dem Cache als Ueberschreitung zaehlen', () => {
    const { wrapper, queryClient } = createHookWrapper();
    queryClient.setQueryData(financeKeys.transactionsAll, [
      tx('2026-03-01', 1000),
      tx('2026-03-05', -1800),
    ]);
    queryClient.setQueryData(['budget-overview'], {
      month: '2026-03',
      suggestions: [],
      statuses: [budgetStatus('over'), budgetStatus('ok'), budgetStatus('over')],
    });

    const { result } = renderHook(() => useGlobalAtmosphere(REFERENCE), { wrapper });

    // Negativer Saldo UND mindestens ein ueberzogenes Budget = akutes Risiko.
    expect(result.current.pulse).toBe('alert');
  });

  it('sollte ohne Budget-Cache keinen Alarm ausloesen', () => {
    const { wrapper, queryClient } = createHookWrapper();
    queryClient.setQueryData(financeKeys.transactionsAll, [
      tx('2026-03-01', 1000),
      tx('2026-03-05', -1800),
    ]);

    const { result } = renderHook(() => useGlobalAtmosphere(REFERENCE), { wrapper });

    // Fehlender Budget-Cache heisst "unbekannt", nicht "null Ueberschreitungen
    // sicher" — er darf die Stimmung nicht verschaerfen.
    expect(result.current.pulse).toBe('steady');
    expect(result.current.temperature).toBe('cool');
  });

  it('sollte bei leerem Transaktions-Cache neutral bleiben', () => {
    const { wrapper, queryClient } = createHookWrapper();
    queryClient.setQueryData(financeKeys.transactionsAll, []);

    const { result } = renderHook(() => useGlobalAtmosphere(REFERENCE), { wrapper });

    expect(result.current.temperature).toBe('neutral');
    expect(result.current.intensity).toBe(0);
  });

  it('sollte bei prefers-reduced-motion nicht pulsieren', () => {
    reduceMock.mockReturnValue(true);
    const { wrapper, queryClient } = createHookWrapper();
    queryClient.setQueryData(financeKeys.transactionsAll, [
      tx('2026-03-01', 1000),
      tx('2026-03-05', -1800),
    ]);
    queryClient.setQueryData(['budget-overview'], {
      month: '2026-03',
      suggestions: [],
      statuses: [budgetStatus('over')],
    });

    const { result } = renderHook(() => useGlobalAtmosphere(REFERENCE), { wrapper });

    expect(result.current.pulse).toBe('steady');
  });
});
