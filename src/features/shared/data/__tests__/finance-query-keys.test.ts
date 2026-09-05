import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  financeKeys,
  FINANCE_UNRELATED_QUERY_KEY_ROOTS,
  invalidateFinanceData,
} from '../finance-query-keys';

describe('finance-query-keys', () => {
  it('sollte byte-identische Keys zu den historischen Inline-Literalen liefern', () => {
    expect(financeKeys.transactionsRoot).toEqual(['transactions']);
    expect(financeKeys.transactionsAll).toEqual(['transactions', 'all']);
    expect(financeKeys.categories).toEqual(['categories']);
    expect(financeKeys.accounts).toEqual(['accounts']);
    expect(financeKeys.contractDecisions).toEqual(['contract-decisions']);
  });

  it('[REGRESSION] sollte den Bestands-Key unter der Wurzel führen, damit eine Invalidierung ihn trifft', () => {
    // GEÄNDERTE ERWARTUNG (Audit 2026-09, F2). Hier stand
    // „sollte das Transaktions-Limit 5000 beibehalten" — ein Test, der die
    // Kappung VERTEIDIGT hat. Das Limit sah wie eine Cache-Entscheidung aus
    // („verhindert Cache-Kollision"), war aber eine Datenentscheidung: Acht
    // ViewModels rechneten Summen und Verläufe auf einem Ausschnitt. Ohne
    // Kappung gibt es nur noch eine Menge und damit einen Key.
    expect(financeKeys.transactionsAll[0]).toBe('transactions');
    expect(financeKeys.transactionsAll).toEqual(['transactions', 'all']);
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

/**
 * S4: Die vier geteilten Schluessel.
 *
 * Sie standen als rohe Literale an rund zwanzig Aufrufstellen und zusaetzlich
 * DREIFACH definiert — in account-, coach- und settings-query-keys. Ein
 * abweichender Schluessel bricht nichts, was `tsc` sieht: Er fuehrt still zwei
 * Caches nebeneinander, und eine Invalidierung trifft dann nur einen davon.
 * Genau deshalb pruefen diese Tests die WERTE und nicht nur die Existenz.
 */
describe('Geteilte Schluessel (S4)', () => {
  it('sollte byte-identisch zu den bisherigen Literalen sein', () => {
    // Diese vier Werte standen so im Bestand. Sie zu aendern hiesse, jeden
    // bestehenden Cache-Eintrag zu verwaisen — deshalb stehen sie hier
    // ausgeschrieben und nicht abgeleitet.
    expect(financeKeys.netWorth).toEqual(['net-worth']);
    expect(financeKeys.budgetOverview).toEqual(['budget-overview']);
    expect(financeKeys.transactionContracts).toEqual(['transactions', 'contracts']);
    expect(financeKeys.milestones('de')).toEqual(['milestones', 'de']);
  });

  it('sollte die Sprache in den Meilenstein-Schluessel aufnehmen', () => {
    // Meilenstein-Titel sind uebersetzt: Eine andere Sprache ist eine andere
    // Frage und damit ein anderer Cache-Eintrag. Waere die Sprache nicht im
    // Schluessel, zeigte ein Sprachwechsel die alten Titel weiter.
    expect(financeKeys.milestones('en')).not.toEqual(financeKeys.milestones('de'));
  });

  it('[REGRESSION] sollte in den Slice-Modulen DIESELBE Referenz liefern', async () => {
    // Der eigentliche Befund: Drei Slices definierten denselben Schluessel je
    // selbst. Gleichheit per Wert wuerde eine spaetere Abweichung nicht
    // verhindern — geprueft wird deshalb, dass sie auf dieselbe Quelle zeigen.
    const [konten, coach, einstellungen] = await Promise.all([
      import('@/features/accounts/data/account-query-keys'),
      import('@/features/coach/data/coach-query-keys'),
      import('@/features/settings/data/settings-query-keys'),
    ]);

    expect(konten.accountQueryKeys.netWorth).toBe(financeKeys.netWorth);
    expect(konten.accountQueryKeys.transactionContracts).toBe(financeKeys.transactionContracts);
    expect(coach.coachKeys.milestones).toBe(financeKeys.milestones);
    expect(einstellungen.SETTINGS_QUERY_KEYS.budgetOverview).toBe(financeKeys.budgetOverview);
  });
});
