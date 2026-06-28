import { describe, it, expect } from 'vitest';
import { runScenarioPayload } from '../scenario-engine';
import { computeCellDetail } from '../cell-details';
import type {
  ForecastAccount,
  ForecastConfig,
  ForecastInput,
  PlannedForecastEvent,
  RecurringFlow,
} from '../../forecast-types';
import type { ScenarioPayload } from '../scenario-payload-types';

/**
 * End-to-end: der Szenario-Lauf liefert die benannten Geldfluss-Posten, und ein
 * Zell-Klick zeigt die vollständige Zusammensetzung (mehrere Balken) – nicht nur
 * eine variable Kategorie.
 */

const START = '2026-01-01';
const CONFIG: ForecastConfig = { startDate: START, months: 6, safetyBuffer: 1000 };
const MC = { trials: 200, seed: 1, incomeVolatility: 0.15 };

const account: ForecastAccount = { id: 'giro', name: 'Girokonto', kind: 'checking', openingBalance: 12000 };
const salary: RecurringFlow = { id: 'salary', name: 'Gehalt', amount: 2500, cadence: 'monthly', anchorDate: START, accountId: 'giro' };
const rent: RecurringFlow = { id: 'rent', name: 'Miete', amount: -1000, cadence: 'monthly', anchorDate: START, accountId: 'giro' };
const purchase: PlannedForecastEvent = { id: 'p1', name: 'Anschaffung', amount: -3000, date: '2026-03-15', accountId: 'giro' };

function input(): ForecastInput {
  return {
    accounts: [account],
    recurringFlows: [salary, rent],
    plannedEvents: [purchase],
    variableExpenses: [{ category: 'Shopping', monthlyAmount: 400, volatility: 0.3, confidence: 0.9 }],
  };
}

const payload: ScenarioPayload = {
  scenarioId: 'base',
  scenarioType: 'base_check',
  timeHorizonDays: 150,
  thresholdAmount: 1000,
};

describe('Szenario-Engine – vollständige Zell-Zusammensetzung', () => {
  it('liefert benannte Einnahmen-, Fixkosten- und geplante Posten', () => {
    const result = runScenarioPayload(input(), CONFIG, payload, { monteCarlo: MC });
    const schedule = result.compositionSchedule!;
    expect(schedule).toBeDefined();
    const byName = (n: string) => schedule.find((s) => s.name === n);
    expect(byName('Gehalt')?.group).toBe('income');
    expect(byName('Miete')?.group).toBe('fixed');
    expect(byName('Anschaffung')?.group).toBe('event');
    // Anschaffung ist ein Einmalposten -> genau eine Buchung im Horizont.
    expect(byName('Anschaffung')?.bookings).toHaveLength(1);
  });

  it('zeigt beim Zell-Klick mehrere Balken über alle Gruppen', () => {
    const result = runScenarioPayload(input(), CONFIG, payload, { monteCarlo: MC });
    const day = result.horizonDays - 1; // letzter Tag: alle Buchungen aufgelaufen
    // Erste nicht-leere Zelle mit Repräsentant finden.
    const repsForDay = result.representativeByCell![day];
    const bin = repsForDay.findIndex((trial, b) => trial >= 0 && (result.density.counts[day][b] ?? 0) > 0);
    expect(bin).toBeGreaterThanOrEqual(0);

    const detail = computeCellDetail({
      density: result.density,
      assumptions: result.assumptions!,
      representativeByCell: result.representativeByCell!,
      compositionSchedule: result.compositionSchedule,
      day,
      bin,
    })!;

    const comp = detail.representative!.composition;
    const groups = new Set(comp.map((c) => c.group));
    expect(groups.has('income')).toBe(true);
    expect(groups.has('fixed')).toBe(true);
    expect(groups.has('variable')).toBe(true);
    expect(groups.has('event')).toBe(true);

    const names = comp.map((c) => c.name);
    expect(names).toContain('Gehalt');
    expect(names).toContain('Miete');
    expect(names).toContain('Shopping');
    expect(names).toContain('Anschaffung');

    // Einnahmen sind Zuflüsse (+), Kosten/Posten Abflüsse (−).
    expect(comp.find((c) => c.name === 'Gehalt')!.amount).toBeGreaterThan(0);
    expect(comp.find((c) => c.name === 'Miete')!.amount).toBeLessThan(0);
    expect(comp.find((c) => c.name === 'Anschaffung')!.amount).toBeCloseTo(-3000, 0);

    // Mit incomeVolatility streut das Gehalt -> als „varies" markiert.
    expect(comp.find((c) => c.name === 'Gehalt')!.varies).toBe(true);
    // Fixkosten/Posten sind in jedem Pfad gleich.
    expect(comp.find((c) => c.name === 'Miete')!.varies).toBe(false);
  });
});
