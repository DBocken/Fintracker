import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@/test-utils/render';
import type { Category, Transaction } from '@/types';
import { useCityModel } from '../use-city-model';

vi.mock('@/services/transaction-service', () => ({
  getTransactions: vi.fn(),
  getCategories: vi.fn(),
}));
vi.mock('@/services/contract-decision-service', () => ({
  getContractDecisionMap: vi.fn(),
}));

import { getTransactions, getCategories } from '@/services/transaction-service';
import { getContractDecisionMap } from '@/services/contract-decision-service';

const CAT_LEISURE = 'cat-leisure';
const CAT_STREAMING = 'cat-streaming';

const FIXTURE_CATEGORIES: Category[] = [
  { id: CAT_LEISURE, name: 'Freizeit', filters: [] },
  { id: CAT_STREAMING, name: 'Streaming', filters: [], parent_id: CAT_LEISURE },
];

const FIXTURE_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    date: '2026-06-05',
    amount: -17.99,
    payee: 'Netflix',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    category_id: CAT_STREAMING,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTransactions).mockResolvedValue(FIXTURE_TRANSACTIONS);
  vi.mocked(getCategories).mockResolvedValue(FIXTURE_CATEGORIES);
  vi.mocked(getContractDecisionMap).mockResolvedValue(new Map());
});

describe('useCityModel', () => {
  it('sollte aus echten Transaktionen/Kategorien ein CityModel mit den erwarteten Distrikten bauen', async () => {
    const { wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCityModel(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isEmpty).toBe(false);
    expect(result.current.model.districts).toHaveLength(1);
    expect(result.current.model.districts[0]).toMatchObject({ id: CAT_LEISURE, label: 'Freizeit' });
    expect(result.current.model.districts[0].subcategories[0]).toMatchObject({
      id: CAT_STREAMING,
      label: 'Streaming',
    });
  });

  it('sollte isLoading während des Ladens true liefern', () => {
    const { wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCityModel(), { wrapper });

    expect(result.current.isLoading).toBe(true);
  });

  it('sollte bei leeren Transaktionen isEmpty=true liefern (kein Demo-Fallback)', async () => {
    vi.mocked(getTransactions).mockResolvedValue([]);
    const { wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCityModel(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isEmpty).toBe(true);
    expect(result.current.model.districts).toHaveLength(0);
  });
});
