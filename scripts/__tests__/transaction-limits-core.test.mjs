import { describe, expect, it } from 'vitest';
import { findeKappungen, istGeprueft } from '../transaction-limits-core.mjs';

/**
 * Beide Richtungen: Der Wächter muss die stille Kappung sehen — und die
 * legitimen Formen in Ruhe lassen. Ein Wächter mit Fehlalarm wird
 * abgeschaltet statt befolgt.
 */

describe('istGeprueft', () => {
  it('sollte alle vier Schichten prüfen, nicht nur Services und Hooks', () => {
    expect(istGeprueft('src/services/budget-service.ts')).toBe(true);
    expect(istGeprueft('src/hooks/useCategoryModel.ts')).toBe(true);
    // Die Hälfte der Aufrufer lag hier — darunter Steuerbericht und EÜR.
    expect(istGeprueft('src/pages/TaxReportPage.tsx')).toBe(true);
    expect(istGeprueft('src/components/ReviewTable.tsx')).toBe(true);
    expect(istGeprueft('src/features/money-questions/application/use-transfer-action.ts')).toBe(true);
  });

  it('sollte Tests nicht prüfen', () => {
    expect(istGeprueft('src/services/__tests__/x.test.ts')).toBe(false);
    expect(istGeprueft('src/pages/TaxReportPage.test.tsx')).toBe(false);
  });
});

describe('findeKappungen', () => {
  it('sollte ein Limit-Literal melden', () => {
    const funde = findeKappungen('const t = await getTransactions(5000);', 'src/services/x.ts');
    expect(funde).toHaveLength(1);
    expect(funde[0].limit).toBe('5000');
  });

  it('sollte auch den Methodenaufruf melden', () => {
    const funde = findeKappungen('await transactionStorage.getTransactions(10000, 0);', 'src/services/x.ts');
    expect(funde).toHaveLength(1);
  });

  it('sollte getAllTransactions und getTransactionsPage in Ruhe lassen', () => {
    const quelle = `
      const alle = await getAllTransactions();
      const seite = await getTransactionsPage(50, 0);
    `;
    expect(findeKappungen(quelle, 'src/services/x.ts')).toEqual([]);
  });

  it('sollte eine benannte Konstante genauso melden wie eine Zahl', () => {
    // Der Fund, den die erste Fassung übersah: Acht ViewModels kappten über
    // FINANCE_TRANSACTION_LIMIT. Eine Modulkonstante IST ein Literal, nur mit
    // Namen — und ein Name macht die Kappung nicht besser, sondern unsichtbar.
    const funde = findeKappungen(
      'const t = await getTransactions(FINANCE_TRANSACTION_LIMIT);',
      'src/features/dashboard/application/use-finance-overview.ts',
    );
    expect(funde).toHaveLength(1);
    expect(funde[0].limit).toBe('FINANCE_TRANSACTION_LIMIT');
  });

  it('sollte ein berechnetes oder durchgereichtes Limit nicht melden', () => {
    // Nur das LITERAL ist der Befund: Wer eine Variable durchreicht, hat das
    // Limit anderswo begründet — der Wächter kann das nicht beurteilen und
    // soll es deshalb nicht behaupten.
    const quelle = 'export const laden = (limit) => getTransactions(limit);';
    expect(findeKappungen(quelle, 'src/services/x.ts')).toEqual([]);
  });
});
