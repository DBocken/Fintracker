import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  financeKeys,
  FINANCE_TRANSACTION_LIMIT,
  FINANCE_UNRELATED_QUERY_KEY_ROOTS,
  invalidateFinanceData,
} from '../finance-query-keys';

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

describe('invalidateFinanceData (WP 4.3, PERF-5)', () => {
  /**
   * Schutz gegen "Vergessen" bei einer benannten Liste: `FINANCE_UNRELATED_
   * QUERY_KEY_ROOTS` ist bewusst eine DENYLIST, keine Allowlist. Ein neuer
   * Finanz-Query-Key, den niemand hier einträgt, fällt NICHT lautlos durchs
   * Raster — er wird per Default-Fall invalidiert. Dieser Test ist der
   * Nachweis dafür und muss bei jedem künftigen Finanz-Key NICHT angepasst
   * werden (anders als bei einer Allowlist, die für jeden neuen Key einen
   * neuen Eintrag bräuchte, um nicht lautlos zu veralten).
   */
  it('[REGRESSION] sollte einen unbekannten, noch nicht existierenden Finanz-Key automatisch mit erfassen', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['ein-schlicht-erfundener-zukuenftiger-finanz-key'], 'x');

    await invalidateFinanceData(queryClient);

    expect(
      queryClient.getQueryState(['ein-schlicht-erfundener-zukuenftiger-finanz-key'])?.isInvalidated,
    ).toBe(true);
  });

  it('sollte nur die dokumentierten, verifiziert unabhängigen Domänen auslassen', async () => {
    const queryClient = new QueryClient();
    for (const root of FINANCE_UNRELATED_QUERY_KEY_ROOTS) {
      queryClient.setQueryData([root], 'x');
    }

    await invalidateFinanceData(queryClient);

    for (const root of FINANCE_UNRELATED_QUERY_KEY_ROOTS) {
      expect(queryClient.getQueryState([root])?.isInvalidated).toBeFalsy();
    }
  });

  it('sollte eine bekannte Finanz-Domäne (Konten) tatsächlich invalidieren', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(financeKeys.accounts, []);

    await invalidateFinanceData(queryClient);

    expect(queryClient.getQueryState(financeKeys.accounts)?.isInvalidated).toBe(true);
  });
});
