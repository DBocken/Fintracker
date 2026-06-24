/**
 * Forecast Engine – Szenario-Layer (Stufe 3: Was-wäre-wenn)
 *
 * Reine Logik ohne IO. Ein Szenario transformiert eine {@link ForecastInput}
 * deterministisch (`applyScenario`) und wird anschließend mit derselben
 * Kern-Engine gerechnet wie die Basis. `runScenarioComparison` stellt Basis und
 * Szenario gegenüber und liefert die relevanten Kennzahl-Deltas.
 *
 * Grundsatz: Der Engine-Kern bleibt unberührt. Szenarien sind Eingabe-
 * Transformationen, keine Sonderpfade im Simulationsschritt.
 */
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { calculateDeterministicForecast } from './forecast';
import type {
  ForecastAccount,
  ForecastConfig,
  ForecastInput,
  ForecastResult,
  PlannedForecastEvent,
  RecurringFlow,
  VariableExpenseBaseline,
} from './forecast-types';
import type {
  ForecastScenario,
  ScenarioComparison,
  ScenarioMetricDelta,
} from './forecast-scenario-types';

const ISO = 'yyyy-MM-dd';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Operative Konten als Default-Ziel für neue Posten. */
function pickDefaultAccount(accounts: ForecastAccount[]): string | null {
  const operating = accounts.find((a) => a.kind === 'checking');
  return (operating ?? accounts[0])?.id ?? null;
}

/**
 * Skaliert die Flows, die `predicate` erfüllen, um `factor`. Mit `fromDate`
 * wird der Flow am Stichtag gesplittet: das Original endet am Vortag, ein
 * skalierter Klon beginnt am Stichtag. So lässt sich z. B. ein Jobverlust
 * ab einem Datum exakt abbilden, ohne den Engine-Kern anzufassen.
 *
 * Wird der Faktor 0 (z. B. Jobverlust, -100 %), entfällt der skalierte Klon
 * vollständig – es entstehen keine Null-Buchungen.
 */
function scaleFlows(
  flows: RecurringFlow[],
  predicate: (amount: number) => boolean,
  factor: number,
  fromDate?: string,
): RecurringFlow[] {
  const out: RecurringFlow[] = [];
  for (const flow of flows) {
    if (!predicate(flow.amount)) {
      out.push(flow);
      continue;
    }
    if (!fromDate) {
      out.push({ ...flow, amount: round2(flow.amount * factor) });
      continue;
    }

    // Vor dem Stichtag: Original, das spätestens am Vortag endet.
    const dayBefore = format(addDays(parseISO(fromDate), -1), ISO);
    const preEnd =
      flow.endDate && flow.endDate < dayBefore ? flow.endDate : dayBefore;
    out.push({ ...flow, id: `${flow.id}__pre`, endDate: preEnd });

    // Ab dem Stichtag: skalierter Klon (entfällt bei Faktor 0).
    if (factor !== 0) {
      const postStart =
        flow.startDate && flow.startDate > fromDate ? flow.startDate : fromDate;
      out.push({
        ...flow,
        id: `${flow.id}__post`,
        amount: round2(flow.amount * factor),
        startDate: postStart,
      });
    }
  }
  return out;
}

/** Skaliert die variable Ausgaben-Baseline (über `budgetOverride`). */
function scaleVariable(
  baselines: VariableExpenseBaseline[],
  factor: number,
): VariableExpenseBaseline[] {
  return baselines.map((b) => ({
    ...b,
    budgetOverride: round2((b.budgetOverride ?? b.monthlyAmount) * factor),
  }));
}

/**
 * Wendet ein Szenario auf den Input an und liefert einen neuen, transformierten
 * Input. Reine Funktion – der ursprüngliche Input bleibt unverändert.
 */
export function applyScenario(
  input: ForecastInput,
  scenario: ForecastScenario,
): ForecastInput {
  let recurringFlows = [...(input.recurringFlows ?? [])];
  let variableExpenses = [...(input.variableExpenses ?? [])];
  let accounts = [...input.accounts];
  const plannedEvents = [...(input.plannedEvents ?? [])];
  const defaultAccount = pickDefaultAccount(input.accounts);

  for (const mod of scenario.modifiers) {
    switch (mod.type) {
      case 'income':
        recurringFlows = scaleFlows(
          recurringFlows,
          (a) => a > 0,
          1 + (mod.percentChange ?? 0) / 100,
          mod.fromDate,
        );
        break;

      case 'expenses':
        recurringFlows = scaleFlows(
          recurringFlows,
          (a) => a < 0,
          1 + (mod.percentChange ?? 0) / 100,
          mod.fromDate,
        );
        break;

      case 'variable':
        variableExpenses = scaleVariable(variableExpenses, 1 + (mod.percentChange ?? 0) / 100);
        break;

      case 'interest': {
        const delta = mod.amount ?? 0;
        accounts = accounts.map((a) => ({
          ...a,
          annualInterestRate: Math.max(0, (a.annualInterestRate ?? 0) + delta),
        }));
        break;
      }

      case 'oneTime': {
        const accountId = mod.accountId ?? defaultAccount;
        if (!accountId || mod.amount == null || !mod.date) break;
        const event: PlannedForecastEvent = {
          id: `scn-${mod.id}`,
          name: mod.label ?? 'Szenario-Posten',
          amount: mod.amount,
          date: mod.date,
          accountId,
        };
        plannedEvents.push(event);
        break;
      }

      case 'recurring': {
        const accountId = mod.accountId ?? defaultAccount;
        if (!accountId || mod.amount == null || !mod.cadence || !mod.anchorDate) break;
        recurringFlows.push({
          id: `scn-${mod.id}`,
          name: mod.label ?? 'Szenario-Verpflichtung',
          amount: mod.amount,
          cadence: mod.cadence,
          anchorDate: mod.anchorDate,
          accountId,
        });
        break;
      }
    }
  }

  return {
    ...input,
    accounts,
    recurringFlows,
    variableExpenses,
    plannedEvents,
  };
}

function makeDelta(baseline: number, scenario: number): ScenarioMetricDelta {
  return { baseline, scenario, delta: round2(scenario - baseline) };
}

function endingNetWorth(result: ForecastResult): number {
  return result.daily.at(-1)?.netWorth ?? 0;
}

/**
 * Verschiebung des ersten Pufferbruchs in Kalendertagen (scenario − baseline).
 * `null`, wenn in genau einer Variante kein Bruch auftritt (kein sinnvoller
 * Tagesvergleich – das Delta der „Tage unter Puffer“ trägt diese Information).
 */
function breachShiftDays(baseline: ForecastResult, scenario: ForecastResult): number | null {
  const b = baseline.risk.firstBelowSafetyBufferDate;
  const s = scenario.risk.firstBelowSafetyBufferDate;
  if (!b || !s) return null;
  return differenceInCalendarDays(parseISO(s), parseISO(b));
}

/**
 * Stellt zwei bereits gerechnete Forecast-Ergebnisse gegenüber (Basis vs.
 * Szenario). Reine Funktion – nützlich, wenn die Basis-Projektion bereits
 * vorliegt und nicht erneut berechnet werden soll (z. B. im UI-Memo).
 */
export function compareForecastResults(
  baseline: ForecastResult,
  scenarioResult: ForecastResult,
  scenario: ForecastScenario,
): ScenarioComparison {
  return {
    scenario,
    lowestBalance: makeDelta(baseline.risk.lowestBalance, scenarioResult.risk.lowestBalance),
    minimumOperatingCash: makeDelta(
      baseline.risk.minimumOperatingCash,
      scenarioResult.risk.minimumOperatingCash,
    ),
    endingNetWorth: makeDelta(endingNetWorth(baseline), endingNetWorth(scenarioResult)),
    daysBelowSafetyBuffer: makeDelta(
      baseline.risk.daysBelowSafetyBuffer,
      scenarioResult.risk.daysBelowSafetyBuffer,
    ),
    firstBreachShiftDays: breachShiftDays(baseline, scenarioResult),
  };
}

/**
 * Rechnet Basis und Szenario mit identischer Konfiguration und stellt die
 * maßgeblichen Kennzahlen gegenüber.
 *
 * @param input    Die ursprünglichen (bereits override-bereinigten) Eingaben.
 * @param config   Horizont, Puffer, Basis – identisch für beide Läufe.
 * @param scenario Das anzuwendende Szenario.
 */
export function runScenarioComparison(
  input: ForecastInput,
  config: ForecastConfig,
  scenario: ForecastScenario,
): ScenarioComparison {
  const baseline = calculateDeterministicForecast(input, config);
  const scenarioResult = calculateDeterministicForecast(applyScenario(input, scenario), config);
  return compareForecastResults(baseline, scenarioResult, scenario);
}

/**
 * Liefert eine kleine Bibliothek sinnvoller Standard-Szenarien, verankert am
 * Forecast-Start. Dient als Startpunkt; Nutzer können eigene Szenarien anlegen.
 */
export function buildPresetScenarios(startISO: string): ForecastScenario[] {
  const base = parseISO(startISO);
  const in30 = format(addDays(base, 30), ISO);
  const in42 = format(addDays(base, 42), ISO);
  const in60 = format(addDays(base, 60), ISO);
  const in90 = format(addDays(base, 90), ISO);
  const in120 = format(addDays(base, 120), ISO);
  return [
    {
      id: 'preset-job-loss',
      name: 'Jobverlust',
      description: 'Einnahmen entfallen ab in 3 Monaten.',
      modifiers: [
        { id: 'm1', type: 'income', percentChange: -100, fromDate: in90 },
      ],
    },
    {
      id: 'preset-raise',
      name: 'Gehaltserhöhung +5 %',
      description: 'Alle Einnahmen steigen dauerhaft um 5 %.',
      modifiers: [{ id: 'm1', type: 'income', percentChange: 5 }],
    },
    {
      id: 'preset-job-change',
      name: 'Jobwechsel',
      description: 'Altes Einkommen endet, neues startet nach einer kurzen Pause.',
      modifiers: [
        { id: 'm1', type: 'income', percentChange: -100, fromDate: in30 },
        { id: 'm2', type: 'recurring', amount: 3200, cadence: 'monthly', anchorDate: in60, label: 'Neues Gehalt' },
      ],
    },
    {
      id: 'preset-car-breakdown',
      name: 'Auto kaputt',
      description: 'Unerwartete Reparatur – Versicherung erstattet verzögert einen Teil.',
      modifiers: [
        { id: 'm1', type: 'oneTime', amount: -2000, date: in30, label: 'Reparaturkosten' },
        { id: 'm2', type: 'oneTime', amount: 800, date: in120, label: 'Versicherungserstattung' },
      ],
    },
    {
      id: 'preset-sick-leave',
      name: 'Krankenausfall',
      description: 'Nach 6 Wochen Krankenstand: Krankengeld statt Gehalt (ca. 70 %).',
      modifiers: [
        { id: 'm1', type: 'income', percentChange: -30, fromDate: in42 },
      ],
    },
    {
      id: 'preset-big-purchase',
      name: 'Große Anschaffung',
      description: 'Einmalige Ausgabe von 3.000 € in 3 Monaten.',
      modifiers: [
        {
          id: 'm1',
          type: 'oneTime',
          amount: -3000,
          date: in90,
          label: 'Große Anschaffung',
        },
      ],
    },
  ];
}
