import { describe, it, expect } from 'vitest';
import { findStreamFlowIds, buildStreamLossScenario } from '../income-stress';
import { runScenarioComparison } from '../forecast-scenario';
import { normalizeMerchantName } from '@/services/merchant-normalization';
import type { IncomeStream } from '../income-streams';
import type { RecurringFlow, ForecastInput } from '../forecast-types';

function stream(overrides: Partial<IncomeStream>): IncomeStream {
  return {
    key: 'anstellung|muster', label: 'Muster GmbH', counterparty: 'muster',
    mainCategoryId: 'anstellung', mainCategoryName: 'Anstellung', isSalary: true,
    cadence: 'regelmaessig', monthlyAverage: 3000, totalInWindow: 36000, lastDateISO: '2024-12-01',
    lastAmount: 3000, monthsActive: 12, trend: 'flat', confidence: 0.95, share: 0.9,
    transactionCount: 12, nextDateISO: '2025-01-01', nextAmount: 3000, monthlyTotals: {},
    ...overrides,
  };
}

function flow(overrides: Partial<RecurringFlow>): RecurringFlow {
  return {
    id: 'f', name: 'Flow', amount: 100, cadence: 'monthly', anchorDate: '2026-01-01',
    accountId: 'giro', ...overrides,
  };
}

describe('findStreamFlowIds', () => {
  it('[REGRESSION] matcht einen Gehaltsstrom per salary-ID trotz abweichendem rohem Flow-Namen', () => {
    // Der rohe Flow-Name enthält Rechtsform/Datum, die normalizeMerchantName entfernt —
    // genau der Fall, an dem ein keyword-Match auf flow.name scheitern würde.
    const flows = [flow({ id: 'salary:muster', name: 'Muster GmbH Entgelt 03/2026', amount: 3000 })];
    expect(findStreamFlowIds(stream({}), flows)).toEqual(['salary:muster']);
  });

  it('matcht einen Vertrags-Einnahme-Flow per normalisiertem Namen', () => {
    const name = 'PAYMENT 847 Twitch Interactive 2024-01-05';
    const flows = [flow({ id: 'c1', name, amount: 120 })];
    const s = stream({ isSalary: false, counterparty: normalizeMerchantName(name), key: 'x' });
    expect(findStreamFlowIds(s, flows)).toEqual(['c1']);
  });

  it('matcht niemals negative Flows (Ausgaben), auch bei Namensgleichheit', () => {
    const flows = [flow({ id: 'rent', name: 'Muster', amount: -1000 })];
    expect(findStreamFlowIds(stream({ counterparty: 'muster' }), flows)).toEqual([]);
  });
});

describe('buildStreamLossScenario', () => {
  it('liefert null, wenn der Strom nicht in der Prognose steckt', () => {
    const flows = [flow({ id: 'salary:other', name: 'Andere', amount: 2000 })];
    expect(buildStreamLossScenario(stream({}), flows)).toBeNull();
  });

  it('baut genau einen flow-Modifier mit factor 0 und kind:ids', () => {
    const flows = [flow({ id: 'salary:muster', name: 'Muster GmbH', amount: 3000 })];
    const scenario = buildStreamLossScenario(stream({}), flows);
    expect(scenario).not.toBeNull();
    expect(scenario!.modifiers).toHaveLength(1);
    const mod = scenario!.modifiers[0];
    expect(mod.type).toBe('flow');
    expect(mod.factor).toBe(0);
    expect(mod.flowSelector).toEqual({ kind: 'ids', ids: ['salary:muster'] });
  });

  it('rechnet als Szenario einen negativen Kontostand-Effekt (E2E-Smoke)', () => {
    const input: ForecastInput = {
      accounts: [{ id: 'giro', name: 'Girokonto', kind: 'checking', openingBalance: 1000 }],
      recurringFlows: [
        flow({ id: 'salary:muster', name: 'Muster GmbH', amount: 3000 }),
        flow({ id: 'rent', name: 'Miete', amount: -1200 }),
      ],
      variableExpenses: [{ category: 'Lebensmittel', monthlyAmount: 300 }],
    };
    const scenario = buildStreamLossScenario(stream({}), input.recurringFlows!)!;
    const comparison = runScenarioComparison(input, { startDate: '2026-01-01', months: 3, safetyBuffer: 500 }, scenario);
    expect(comparison.lowestBalance.delta).toBeLessThan(0);
  });
});
