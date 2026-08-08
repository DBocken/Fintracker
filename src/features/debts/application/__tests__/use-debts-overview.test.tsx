import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@/test-utils/render';
import type { Debt } from '@/types';
import { useDebtsOverview } from '../use-debts-overview';

/**
 * Das ViewModel der Schulden-Fläche.
 *
 * Diese Tests waren vor der Zerlegung nicht möglich: Abfragen, Mutationen und
 * Ableitungen standen in `DebtsPage.tsx` und liessen sich nur über einen
 * gerenderten Screen ansprechen. Genau deshalb konnte der `parseFloat`-Fehler
 * in der Zusatztilgung so lange überleben — sichtbar wird er erst am
 * berechneten Plan, und den hat nie ein Test angefasst.
 */
vi.mock('@/services/debt-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/debt-service')>();
  return {
    ...actual,
    getDebts: vi.fn(),
    getDebtTransactionAssignments: vi.fn(),
    createDebt: vi.fn(),
    updateDebt: vi.fn(),
    deleteDebt: vi.fn(),
    assignTransactionToDebt: vi.fn(),
    unassignDebtTransaction: vi.fn(),
  };
});
vi.mock('@/services/transaction-service', () => ({
  getTransactions: vi.fn(),
}));
vi.mock('@/services/financial-health-service', () => ({
  getFinancialHealth: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { getDebts, getDebtTransactionAssignments } from '@/services/debt-service';
import { getTransactions } from '@/services/transaction-service';
import { getFinancialHealth } from '@/services/financial-health-service';

function makeDebt(overrides: Partial<Debt>): Debt {
  return {
    id: overrides.id || 'debt-1',
    user_id: 'local',
    name: 'Schuld',
    type: 'other',
    balance: 0,
    interest_rate: 0,
    min_payment: 0,
    is_bnpl: false,
    is_paid_off: false,
    ...overrides,
  };
}

/** Eine Schuld, die sich mit reiner Mindestrate sehr lange hinzieht. */
const LANGLAEUFER = makeDebt({ id: 'a', balance: 12000, min_payment: 100, interest_rate: 5 });

function setupQueries(debts: Debt[]) {
  vi.mocked(getDebts).mockResolvedValue(debts);
  vi.mocked(getDebtTransactionAssignments).mockResolvedValue([]);
  vi.mocked(getTransactions).mockResolvedValue([]);
  vi.mocked(getFinancialHealth).mockResolvedValue({
    monthlyIncome: 2500,
    monthlyExpenses: 2000,
  } as Awaited<ReturnType<typeof getFinancialHealth>>);
}

describe('useDebtsOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('sollte Gesamtstand und Mindestrate aus den geladenen Schulden ableiten', async () => {
    setupQueries([
      makeDebt({ id: 'a', balance: 1000, min_payment: 50 }),
      makeDebt({ id: 'b', balance: 500, min_payment: 25 }),
    ]);
    const { wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDebtsOverview(), { wrapper });

    await waitFor(() => expect(result.current.debts).toHaveLength(2));
    expect(result.current.totalDebt).toBe(1500);
    expect(result.current.totalMin).toBe(75);
  });

  it('[REGRESSION] sollte 1.200 € Zusatztilgung als 1.200 € rechnen, nicht als 1,20 €', async () => {
    // `parseFloat("1.200")` lieferte 1.2. Der Plan wurde damit praktisch nur
    // aus der Mindestrate gerechnet — der Nutzer sah trotz vierstelliger Angabe
    // keine spürbare Verkürzung und konnte sich das nicht erklären. Das Lesen
    // der Eingabe liegt jetzt in `<DecimalInput>`; hier wird geprüft, dass der
    // gelesene Wert auch wirklich in den Plan eingeht.
    setupQueries([LANGLAEUFER]);
    const { wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDebtsOverview(), { wrapper });
    await waitFor(() => expect(result.current.debts).toHaveLength(1));

    const nurMindestrate = result.current.payoffPlan.totalMonths;

    act(() => result.current.setExtraBudget(1200));
    await waitFor(() => expect(result.current.extraPayment).toBe(1200));

    // Mit 1.300 € pro Monat ist die Schuld in rund zehn Monaten weg; mit dem
    // alten Lesefehler (1,20 € extra) wären es weiterhin über hundert.
    expect(result.current.payoffPlan.totalMonths).toBeLessThan(nurMindestrate);
    expect(result.current.payoffPlan.totalMonths).toBeLessThanOrEqual(12);
  });

  it('[REGRESSION] sollte die Cent einer Zusatztilgung nicht verschlucken', async () => {
    setupQueries([LANGLAEUFER]);
    const { wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDebtsOverview(), { wrapper });
    await waitFor(() => expect(result.current.debts).toHaveLength(1));

    act(() => result.current.setExtraBudget(12.5));
    await waitFor(() => expect(result.current.extraPayment).toBe(12.5));
  });

  it('sollte ein leeres Zusatztilgungs-Feld als 0 behandeln statt zu werfen', async () => {
    // `null` heißt „nichts eingetragen" — das ist der Wert, den
    // `<DecimalInput>` bei leerem oder unlesbarem Feld meldet. Der Plan muss
    // dann unverändert weiterrechnen, nicht abstürzen.
    setupQueries([LANGLAEUFER]);
    const { wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDebtsOverview(), { wrapper });
    await waitFor(() => expect(result.current.debts).toHaveLength(1));

    const vorher = result.current.payoffPlan.totalMonths;
    act(() => result.current.setExtraBudget(null));
    await waitFor(() => expect(result.current.extraBudget).toBeNull());
    expect(result.current.extraPayment).toBe(0);
    expect(result.current.payoffPlan.totalMonths).toBe(vorher);
  });

  it('[ZUSTAND /debts:fehler] sollte einen Lesefehler als Fehler melden, nicht als leere Liste', async () => {
    vi.mocked(getDebts).mockRejectedValue(new Error('IndexedDB kaputt'));
    vi.mocked(getDebtTransactionAssignments).mockResolvedValue([]);
    vi.mocked(getTransactions).mockResolvedValue([]);
    vi.mocked(getFinancialHealth).mockResolvedValue({
      monthlyIncome: 0,
      monthlyExpenses: 0,
    } as Awaited<ReturnType<typeof getFinancialHealth>>);

    const { wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDebtsOverview(), { wrapper });

    await waitFor(() => expect(result.current.hasLoadError).toBe(true));
    // Die Liste ist leer UND es ist ein Fehler — beides zugleich. Wer nur die
    // Länge prüft, kann die beiden Aussagen nicht auseinanderhalten.
    expect(result.current.debts).toEqual([]);
  });

  it('[ZUSTAND /debts:leer] sollte ohne Schulden keinen Fehler behaupten', async () => {
    setupQueries([]);
    const { wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDebtsOverview(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasLoadError).toBe(false);
    expect(result.current.debts).toEqual([]);
    expect(result.current.causes).toEqual([]);
  });

  it('sollte die Schuldenursachen nach Anteil aufschlüsseln', async () => {
    setupQueries([
      makeDebt({ id: 'a', type: 'credit_card', balance: 750 }),
      makeDebt({ id: 'b', type: 'other', balance: 250 }),
    ]);
    const { wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDebtsOverview(), { wrapper });

    await waitFor(() => expect(result.current.causes).toHaveLength(2));
    expect(result.current.causes[0].pct).toBe(75);
    expect(result.current.causes[1].pct).toBe(25);
  });
});
