import { describe, it, expect } from 'vitest';
import {
  applyScenario,
  runScenarioComparison,
  buildPresetScenarios,
} from '@/lib/forecast-scenario';
import { calculateDeterministicForecast } from '@/lib/forecast';
import type { ForecastAccount, ForecastInput, RecurringFlow } from '@/lib/forecast-types';
import type { ForecastScenario } from '@/lib/forecast-scenario-types';

const START = '2026-01-01';
const CONFIG = { startDate: START, months: 6 };

function checking(openingBalance: number, id = 'giro'): ForecastAccount {
  return { id, name: 'Girokonto', kind: 'checking', openingBalance };
}

function tagesgeld(openingBalance: number, id = 'tg'): ForecastAccount {
  return { id, name: 'Tagesgeld', kind: 'savings', openingBalance };
}

const salary: RecurringFlow = {
  id: 'salary',
  name: 'Gehalt',
  amount: 2500,
  cadence: 'monthly',
  anchorDate: '2026-01-01',
  accountId: 'giro',
};

const rent: RecurringFlow = {
  id: 'rent',
  name: 'Miete',
  amount: -1000,
  cadence: 'monthly',
  anchorDate: '2026-01-01',
  accountId: 'giro',
};

function baseInput(): ForecastInput {
  return {
    accounts: [checking(5000)],
    recurringFlows: [salary, rent],
    variableExpenses: [{ category: 'Lebensmittel', monthlyAmount: 300 }],
  };
}

function lastOperating(input: ForecastInput) {
  return calculateDeterministicForecast(input, CONFIG).daily.at(-1)!.operatingCash;
}

describe('applyScenario – Eingabe-Transformation', () => {
  it('lässt den Originalinput unverändert (pure)', () => {
    const input = baseInput();
    const before = JSON.stringify(input);
    applyScenario(input, {
      id: 's',
      name: 'x',
      modifiers: [{ id: 'm', type: 'income', percentChange: -50 }],
    });
    expect(JSON.stringify(input)).toBe(before);
  });

  it('skaliert Einnahmen prozentual (Gehaltserhöhung)', () => {
    const scenario: ForecastScenario = {
      id: 's',
      name: 'Erhöhung',
      modifiers: [{ id: 'm', type: 'income', percentChange: 10 }],
    };
    const out = applyScenario(baseInput(), scenario);
    const flow = out.recurringFlows!.find((f) => f.id === 'salary')!;
    expect(flow.amount).toBe(2750); // 2500 * 1.1
    // Miete bleibt unangetastet.
    expect(out.recurringFlows!.find((f) => f.id === 'rent')!.amount).toBe(-1000);
  });

  it('skaliert nur Ausgaben bei expenses', () => {
    const out = applyScenario(baseInput(), {
      id: 's',
      name: 'Inflation',
      modifiers: [{ id: 'm', type: 'expenses', percentChange: 20 }],
    });
    expect(out.recurringFlows!.find((f) => f.id === 'rent')!.amount).toBe(-1200);
    expect(out.recurringFlows!.find((f) => f.id === 'salary')!.amount).toBe(2500);
  });

  it('splittet Flows bei fromDate (Jobverlust ab Datum)', () => {
    const out = applyScenario(baseInput(), {
      id: 's',
      name: 'Jobverlust',
      modifiers: [{ id: 'm', type: 'income', percentChange: -100, fromDate: '2026-04-01' }],
    });
    const salaryFlows = out.recurringFlows!.filter((f) => f.id.startsWith('salary'));
    // Faktor 0 -> nur das Vor-Segment bleibt, endet am Vortag des Stichtags.
    expect(salaryFlows).toHaveLength(1);
    expect(salaryFlows[0].id).toBe('salary__pre');
    expect(salaryFlows[0].endDate).toBe('2026-03-31');
  });

  it('skaliert die variable Baseline über budgetOverride', () => {
    const out = applyScenario(baseInput(), {
      id: 's',
      name: 'mehr',
      modifiers: [{ id: 'm', type: 'variable', percentChange: 50 }],
    });
    expect(out.variableExpenses![0].budgetOverride).toBe(450); // 300 * 1.5
    expect(out.variableExpenses![0].monthlyAmount).toBe(300); // Baseline bleibt
  });

  it('erhöht Zinssätze um Prozentpunkte (interest)', () => {
    const input: ForecastInput = {
      accounts: [checking(1000), { ...tagesgeld(5000), annualInterestRate: 1 }],
    };
    const out = applyScenario(input, {
      id: 's',
      name: 'Zinswende',
      modifiers: [{ id: 'm', type: 'interest', amount: 1.5 }],
    });
    expect(out.accounts.find((a) => a.id === 'tg')!.annualInterestRate).toBe(2.5);
    // Giro startet bei 0 -> 1.5.
    expect(out.accounts.find((a) => a.id === 'giro')!.annualInterestRate).toBe(1.5);
  });

  it('hängt einen einmaligen Schock als Event an (oneTime)', () => {
    const out = applyScenario(baseInput(), {
      id: 's',
      name: 'Auto kaputt',
      modifiers: [
        { id: 'm', type: 'oneTime', amount: -2000, date: '2026-03-15', label: 'Reparatur' },
      ],
    });
    const ev = out.plannedEvents!.find((e) => e.id === 'scn-m')!;
    expect(ev.amount).toBe(-2000);
    expect(ev.date).toBe('2026-03-15');
    expect(ev.accountId).toBe('giro');
  });

  it('fügt eine neue wiederkehrende Verpflichtung hinzu (recurring)', () => {
    const out = applyScenario(baseInput(), {
      id: 's',
      name: 'Kredit',
      modifiers: [
        {
          id: 'm',
          type: 'recurring',
          amount: -250,
          cadence: 'monthly',
          anchorDate: '2026-01-15',
          label: 'Kreditrate',
        },
      ],
    });
    const flow = out.recurringFlows!.find((f) => f.id === 'scn-m')!;
    expect(flow.amount).toBe(-250);
    expect(flow.cadence).toBe('monthly');
  });
});

describe('Szenario-Effekt auf die Projektion', () => {
  it('Jobverlust senkt den Endbestand gegenüber der Basis deutlich', () => {
    const input = baseInput();
    const base = lastOperating(input);
    const scenarioInput = applyScenario(input, {
      id: 's',
      name: 'Jobverlust',
      modifiers: [{ id: 'm', type: 'income', percentChange: -100, fromDate: '2026-04-01' }],
    });
    const scn = lastOperating(scenarioInput);
    // Drei entfallene Gehälter (Apr, Mai, Jun) = 7500 weniger.
    expect(base - scn).toBeCloseTo(7500, 2);
  });

  it('Jobverlust ab Datum: Gehalt fließt davor noch, danach nicht', () => {
    const scenarioInput = applyScenario(baseInput(), {
      id: 's',
      name: 'Jobverlust',
      modifiers: [{ id: 'm', type: 'income', percentChange: -100, fromDate: '2026-04-01' }],
    });
    const result = calculateDeterministicForecast(scenarioInput, CONFIG);
    const march = result.daily.find((d) => d.date === '2026-03-01')!;
    const april = result.daily.find((d) => d.date === '2026-04-01')!;
    expect(march.inflows).toBe(2500); // noch Gehalt
    expect(april.inflows).toBe(0); // kein Gehalt mehr
  });
});

describe('runScenarioComparison', () => {
  it('liefert Basis, Szenario und Delta je Kennzahl', () => {
    const cmp = runScenarioComparison(baseInput(), CONFIG, {
      id: 's',
      name: 'Jobverlust',
      modifiers: [{ id: 'm', type: 'income', percentChange: -100, fromDate: '2026-04-01' }],
    });
    expect(cmp.minimumOperatingCash.delta).toBeLessThan(0);
    expect(cmp.endingNetWorth.delta).toBe(-7500);
    expect(cmp.daysBelowSafetyBuffer.delta).toBeGreaterThanOrEqual(0);
  });

  it('ein Null-Szenario ergibt überall Delta 0', () => {
    const cmp = runScenarioComparison(baseInput(), CONFIG, {
      id: 's',
      name: 'leer',
      modifiers: [],
    });
    expect(cmp.lowestBalance.delta).toBe(0);
    expect(cmp.minimumOperatingCash.delta).toBe(0);
    expect(cmp.endingNetWorth.delta).toBe(0);
    expect(cmp.firstBreachShiftDays).toBeNull();
  });

  it('erzeugt durch einen großen Schock einen Pufferbruch, den die Basis nicht hat', () => {
    // Basis wächst (Gehalt > Ausgaben) und bleibt über dem Puffer; erst der
    // Schock drückt den Bestand darunter.
    const input: ForecastInput = {
      accounts: [checking(3000)],
      recurringFlows: [salary, rent],
      variableExpenses: [{ category: 'X', monthlyAmount: 300 }],
    };
    const cmp = runScenarioComparison(
      input,
      { ...CONFIG, safetyBuffer: 2000 },
      {
        id: 's',
        name: 'Schock',
        modifiers: [{ id: 'm', type: 'oneTime', amount: -5000, date: '2026-02-15' }],
      },
    );
    // Basis ohne Bruch, Szenario mit Bruch -> mehr Tage unter Puffer.
    expect(cmp.daysBelowSafetyBuffer.baseline).toBe(0);
    expect(cmp.daysBelowSafetyBuffer.delta).toBeGreaterThan(0);
  });
});

describe('buildPresetScenarios', () => {
  it('liefert alle Standard-Szenarien mit Modifikatoren', () => {
    const presets = buildPresetScenarios(START);
    const ids = presets.map((p) => p.id);
    expect(ids).toContain('preset-job-loss');
    expect(ids).toContain('preset-raise');
    expect(ids).toContain('preset-job-change');
    expect(ids).toContain('preset-car-breakdown');
    expect(ids).toContain('preset-sick-leave');
    expect(ids).toContain('preset-big-purchase');
    expect(ids).toContain('preset-rent-increase');
    expect(ids).toContain('preset-parental-leave');
    expect(ids).toContain('preset-alimony-loss');
    expect(presets.every((p) => p.modifiers.length > 0)).toBe(true);
  });

  it('preset-job-loss: Einnahmen entfallen ab +90 Tage', () => {
    const preset = buildPresetScenarios(START).find((p) => p.id === 'preset-job-loss')!;
    expect(preset.modifiers[0].percentChange).toBe(-100);
    expect(preset.modifiers[0].fromDate).toBe('2026-04-01'); // START +90d
  });

  it('preset-job-change: Einkommen endet ab +30d, neues Gehalt ab +60d', () => {
    const preset = buildPresetScenarios(START).find((p) => p.id === 'preset-job-change')!;
    expect(preset.modifiers).toHaveLength(2);
    expect(preset.modifiers[0]).toMatchObject({ type: 'income', percentChange: -100, fromDate: '2026-01-31' });
    expect(preset.modifiers[1]).toMatchObject({ type: 'recurring', amount: 3200, cadence: 'monthly', anchorDate: '2026-03-02' });
  });

  it('preset-car-breakdown: Ausgabe in +30d, Erstattung in +120d', () => {
    const preset = buildPresetScenarios(START).find((p) => p.id === 'preset-car-breakdown')!;
    expect(preset.modifiers).toHaveLength(2);
    expect(preset.modifiers[0]).toMatchObject({ type: 'oneTime', amount: -2000, date: '2026-01-31' });
    expect(preset.modifiers[1]).toMatchObject({ type: 'oneTime', amount: 800, date: '2026-05-01' });
  });

  it('preset-sick-leave: Einnahmen sinken um 30 % ab +42 Tage', () => {
    const preset = buildPresetScenarios(START).find((p) => p.id === 'preset-sick-leave')!;
    expect(preset.modifiers[0]).toMatchObject({ type: 'income', percentChange: -30, fromDate: '2026-02-12' });
  });

  it('preset-sick-leave senkt die Einnahmen messbar im Vergleich zur Basis', () => {
    const input: ForecastInput = {
      accounts: [checking(5000)],
      recurringFlows: [
        { id: 'sal', name: 'Gehalt', amount: 3000, cadence: 'monthly', anchorDate: START, accountId: 'giro' },
      ],
    };
    const preset = buildPresetScenarios(START).find((p) => p.id === 'preset-sick-leave')!;
    const cmp = runScenarioComparison(input, CONFIG, preset);
    expect(cmp.endingNetWorth.delta).toBeLessThan(0);
  });

  it('preset-job-change: nach der Lücke kommt das neue Gehalt an', () => {
    const input: ForecastInput = {
      accounts: [checking(5000)],
      recurringFlows: [
        { id: 'sal', name: 'Gehalt', amount: 3000, cadence: 'monthly', anchorDate: START, accountId: 'giro' },
      ],
    };
    const preset = buildPresetScenarios(START).find((p) => p.id === 'preset-job-change')!;
    const scenarioInput = applyScenario(input, preset);
    // Neuer Flow mit 3200 muss vorhanden sein
    expect(scenarioInput.recurringFlows?.some((f) => f.amount === 3200)).toBe(true);
  });

  it('preset-rent-increase: Fixausgaben steigen um 15 % ab +30 Tage', () => {
    const preset = buildPresetScenarios(START).find((p) => p.id === 'preset-rent-increase')!;
    expect(preset.modifiers[0]).toMatchObject({ type: 'expenses', percentChange: 15 });
    expect(preset.modifiers[0].fromDate).toBeDefined();
  });

  it('preset-rent-increase senkt den Endbestand gegenüber Basis', () => {
    const input: ForecastInput = {
      accounts: [checking(5000)],
      recurringFlows: [salary, rent],
    };
    const preset = buildPresetScenarios(START).find((p) => p.id === 'preset-rent-increase')!;
    const cmp = runScenarioComparison(input, CONFIG, preset);
    expect(cmp.endingNetWorth.delta).toBeLessThan(0);
  });

  it('preset-parental-leave: Einkommen sinkt um 35 % ab +30 Tage', () => {
    const preset = buildPresetScenarios(START).find((p) => p.id === 'preset-parental-leave')!;
    expect(preset.modifiers[0]).toMatchObject({ type: 'income', percentChange: -35 });
    expect(preset.modifiers[0].fromDate).toBeDefined();
  });

  it('preset-parental-leave senkt den Endbestand gegenüber Basis', () => {
    const input: ForecastInput = {
      accounts: [checking(5000)],
      recurringFlows: [salary, rent],
    };
    const preset = buildPresetScenarios(START).find((p) => p.id === 'preset-parental-leave')!;
    const cmp = runScenarioComparison(input, CONFIG, preset);
    expect(cmp.endingNetWorth.delta).toBeLessThan(0);
  });

  it('preset-alimony-loss: Einkommen sinkt um 20 % ab +14 Tage', () => {
    const preset = buildPresetScenarios(START).find((p) => p.id === 'preset-alimony-loss')!;
    expect(preset.modifiers[0]).toMatchObject({ type: 'income', percentChange: -20 });
    expect(preset.modifiers[0].fromDate).toBeDefined();
  });

  it('buildPresetScenarios enthält alle 9 Standard-Szenarien', () => {
    const presets = buildPresetScenarios(START);
    expect(presets).toHaveLength(9);
    const ids = presets.map((p) => p.id);
    expect(ids).toContain('preset-rent-increase');
    expect(ids).toContain('preset-parental-leave');
    expect(ids).toContain('preset-alimony-loss');
  });
});
