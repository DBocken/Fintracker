import { describe, it, expect } from 'vitest';
import { projectCategorySpend } from '@/lib/forecast-category-projection';
import type { RecurringFlow, VariableExpenseBaseline } from '@/lib/forecast-types';

/**
 * WP-5.2 — Prognose je Kategorie und Monat.
 *
 * Die Prognose wird NICHT neu erfunden: sie kommt aus denselben Bausteinen,
 * die der deterministische Forecast ohnehin verwendet — wiederkehrende Flows
 * (`buildRecurringFlows`) entlang ihres echten Rhythmus über `listFlowOccurrences`,
 * plus die variablen Baselines (`buildVariableExpenseBaselines`). Diese Datei
 * fasst sie nur je Kategorie und Monat zusammen, damit die Finanzstadt einen
 * Zukunftsmonat zeigen kann, ohne eine zweite Prognose zu bauen, die der
 * bestehenden widersprechen könnte.
 *
 * Verschlüsselt wird über die Kategorie-**ID**, nicht über den Anzeigenamen —
 * AGENTS.md §6 führt das Namens-Matching als dokumentierte Falle („bricht bei
 * Umbenennung und in jeder anderen Sprache").
 */
function flow(partial: Partial<RecurringFlow>): RecurringFlow {
  return {
    id: 'flow-1',
    name: 'Test',
    amount: -50,
    cadence: 'monthly',
    anchorDate: '2026-01-10',
    accountId: 'acc',
    ...partial,
  };
}

function baseline(partial: Partial<VariableExpenseBaseline>): VariableExpenseBaseline {
  return { category: 'Lebensmittel', monthlyAmount: 300, ...partial };
}

describe('projectCategorySpend', () => {
  it('sollte eine monatliche Ausgabe im Zielmonat verbuchen', () => {
    const result = projectCategorySpend(
      { recurringFlows: [flow({ categoryId: 'streaming', amount: -12.99 })], variableExpenses: [] },
      '2026-09',
    );

    expect(result.get('streaming')).toBeCloseTo(12.99, 10);
  });

  it('sollte eine vierteljährliche Zahlung nur in ihren Fälligkeitsmonaten verbuchen', () => {
    // Der eigentliche Grund, die Zyklus-Logik des Forecasts wiederzuverwenden
    // statt „Monatsbetrag = Jahresbetrag / 12" zu rechnen: eine
    // Quartalszahlung ist in drei von vier Monaten schlicht nicht da.
    const input = {
      recurringFlows: [flow({ categoryId: 'versicherung', amount: -300, cadence: 'quarterly' as const, anchorDate: '2026-01-15' })],
      variableExpenses: [],
    };

    expect(projectCategorySpend(input, '2026-04').get('versicherung')).toBeCloseTo(300, 10);
    expect(projectCategorySpend(input, '2026-05').get('versicherung')).toBeUndefined();
  });

  it('sollte Einnahmen nicht als Ausgabe verbuchen', () => {
    const result = projectCategorySpend(
      { recurringFlows: [flow({ categoryId: 'gehalt', amount: 3000 })], variableExpenses: [] },
      '2026-09',
    );

    expect(result.get('gehalt')).toBeUndefined();
  });

  it('sollte die variable Baseline je Kategorie übernehmen', () => {
    const result = projectCategorySpend(
      { recurringFlows: [], variableExpenses: [baseline({ categoryId: 'lebensmittel', monthlyAmount: 420 })] },
      '2026-09',
    );

    expect(result.get('lebensmittel')).toBeCloseTo(420, 10);
  });

  it('sollte einen Budget-Override der Baseline vorziehen', () => {
    // Budget-Semantik des Forecasts: der Plan ersetzt die Historie, er
    // begrenzt sie nicht (`VariableExpenseBaseline.budgetOverride`).
    const result = projectCategorySpend(
      {
        recurringFlows: [],
        variableExpenses: [baseline({ categoryId: 'lebensmittel', monthlyAmount: 420, budgetOverride: 350 })],
      },
      '2026-09',
    );

    expect(result.get('lebensmittel')).toBeCloseTo(350, 10);
  });

  it('sollte einen vorhandenen Monatsplan dem Mittelwert vorziehen', () => {
    // `monthlyAmounts` hält reale Monatsschwankungen fest — Monte Carlo nutzt
    // sie aus demselben Grund.
    const result = projectCategorySpend(
      {
        recurringFlows: [],
        variableExpenses: [
          baseline({ categoryId: 'lebensmittel', monthlyAmount: 420, monthlyAmounts: { '2026-09': 500 } }),
        ],
      },
      '2026-09',
    );

    expect(result.get('lebensmittel')).toBeCloseTo(500, 10);
  });

  it('sollte Fixkosten und variable Ausgaben derselben Kategorie addieren', () => {
    const result = projectCategorySpend(
      {
        recurringFlows: [flow({ categoryId: 'wohnen', amount: -800 })],
        variableExpenses: [baseline({ categoryId: 'wohnen', monthlyAmount: 50 })],
      },
      '2026-09',
    );

    expect(result.get('wohnen')).toBeCloseTo(850, 10);
  });

  it('[REGRESSION] sollte Einträge ohne Kategorie-ID überspringen statt sie über den Namen zuzuordnen', () => {
    // AGENTS.md §6: Matching über den Anzeigenamen bricht bei Umbenennung und
    // in jeder anderen Sprache. Lieber keine Prognose für diese Kategorie als
    // eine, die dem falschen Gebäude zugeschlagen wird.
    const result = projectCategorySpend(
      {
        recurringFlows: [flow({ amount: -99 })],
        variableExpenses: [baseline({ monthlyAmount: 300 })],
      },
      '2026-09',
    );

    expect(result.size).toBe(0);
  });

  it('sollte einen unbrauchbaren Monatsschlüssel als leeres Ergebnis behandeln', () => {
    const input = {
      recurringFlows: [flow({ categoryId: 'streaming' })],
      variableExpenses: [baseline({ categoryId: 'lebensmittel' })],
    };

    expect(projectCategorySpend(input, 'kaputt').size).toBe(0);
    expect(projectCategorySpend(input, '').size).toBe(0);
  });

  it('sollte einen beendeten Flow nach seinem Enddatum nicht mehr verbuchen', () => {
    const input = {
      recurringFlows: [flow({ categoryId: 'streaming', endDate: '2026-08-31' })],
      variableExpenses: [],
    };

    expect(projectCategorySpend(input, '2026-08').get('streaming')).toBeCloseTo(50, 10);
    expect(projectCategorySpend(input, '2026-09').get('streaming')).toBeUndefined();
  });
});
