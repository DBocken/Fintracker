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
  FlowSelector,
  ForecastScenario,
  ScenarioComparison,
  ScenarioMetricDelta,
} from './forecast-scenario-types';
import type { RecurringCadence } from './forecast-types';

const ISO = 'yyyy-MM-dd';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Operative Konten als Default-Ziel für neue Posten. */
function pickDefaultAccount(accounts: ForecastAccount[]): string | null {
  const operating = accounts.find((a) => a.kind === 'checking');
  return (operating ?? accounts[0])?.id ?? null;
}

/** Normiert einen Flow-Betrag auf einen Monatswert – für „größter Eintrag". */
function monthlyMagnitude(flow: RecurringFlow): number {
  const factorByCadence: Record<RecurringCadence, number> = {
    weekly: 52 / 12,
    biweekly: 26 / 12,
    monthly: 1,
    quarterly: 1 / 3,
    semiannual: 1 / 6,
    annual: 1 / 12,
    custom: 30 / Math.max(1, flow.intervalDays ?? 30),
  };
  return Math.abs(flow.amount) * factorByCadence[flow.cadence];
}

/** Der nach Monatsbetrag größte Flow, der `predicate` erfüllt (als ID-Set). */
function largestBy(
  flows: RecurringFlow[],
  predicate: (flow: RecurringFlow) => boolean,
): Set<string> {
  let best: RecurringFlow | null = null;
  for (const flow of flows) {
    if (!predicate(flow)) continue;
    if (!best || monthlyMagnitude(flow) > monthlyMagnitude(best)) best = flow;
  }
  return best ? new Set([best.id]) : new Set();
}

/**
 * Löst eine {@link FlowSelector} gegen die aktuellen Flows auf und liefert die
 * Menge der getroffenen Flow-IDs. So treffen Szenarien konkrete Einträge:
 *  - `ids`: genau diese IDs.
 *  - `largestIncome`: der größte (monatlich normierte) Einkommens-Eintrag –
 *    ein Jobverlust trifft das Hauptgehalt, nicht zusätzlich den Nebenjob.
 *  - `keyword`: Einträge, deren Name oder Kategorie das Schlüsselwort enthält.
 */
export function resolveFlowSelector(
  selector: FlowSelector,
  flows: RecurringFlow[],
): Set<string> {
  switch (selector.kind) {
    case 'ids':
      return new Set(selector.ids);

    case 'largestIncome':
      return largestBy(flows, (f) => f.amount > 0);

    case 'largestExpense':
      return largestBy(flows, (f) => f.amount < 0);

    case 'keyword': {
      const needle = selector.keyword.toLowerCase();
      const ids = new Set<string>();
      for (const flow of flows) {
        if (selector.direction === 'income' && flow.amount <= 0) continue;
        if (selector.direction === 'expense' && flow.amount >= 0) continue;
        const haystack = `${flow.name} ${flow.category ?? ''}`.toLowerCase();
        if (haystack.includes(needle)) ids.add(flow.id);
      }
      return ids;
    }
  }
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
  predicate: (flow: RecurringFlow) => boolean,
  factor: number,
  fromDate?: string,
): RecurringFlow[] {
  const out: RecurringFlow[] = [];
  for (const flow of flows) {
    if (!predicate(flow)) {
      out.push(flow);
      continue;
    }
    if (!fromDate) {
      // Faktor 0 = der Eintrag entfällt vollständig (kein Null-Flow, der in der
      // UI weiter als „aktiv mit 0 €" auftauchen würde).
      if (factor !== 0) out.push({ ...flow, amount: round2(flow.amount * factor) });
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
          (f) => f.amount > 0,
          1 + (mod.percentChange ?? 0) / 100,
          mod.fromDate,
        );
        break;

      case 'expenses':
        recurringFlows = scaleFlows(
          recurringFlows,
          (f) => f.amount < 0,
          1 + (mod.percentChange ?? 0) / 100,
          mod.fromDate,
        );
        break;

      case 'flow': {
        // Konkrete Einträge treffen (Gehalt, Unterhalt …) statt pauschaler
        // Prozentsätze. Ohne Treffer ist der Modifikator ein No-Op – wer keinen
        // Unterhalt bezieht, dessen „Unterhalt fällt weg" ändert nichts.
        if (!mod.flowSelector) break;
        const targetIds = resolveFlowSelector(mod.flowSelector, recurringFlows);
        if (targetIds.size === 0) break;
        recurringFlows = scaleFlows(
          recurringFlows,
          (f) => targetIds.has(f.id),
          mod.factor ?? 0,
          mod.fromDate,
        );
        break;
      }

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
  const in14 = format(addDays(base, 14), ISO);
  const in30 = format(addDays(base, 30), ISO);
  const in42 = format(addDays(base, 42), ISO);
  const in60 = format(addDays(base, 60), ISO);
  const in90 = format(addDays(base, 90), ISO);
  const in120 = format(addDays(base, 120), ISO);
  return [
    {
      id: 'preset-job-loss',
      name: 'Jobverlust',
      description: 'Das Haupteinkommen entfällt ab in 3 Monaten – andere Einnahmen bleiben.',
      modifiers: [
        { id: 'm1', type: 'flow', flowSelector: { kind: 'largestIncome' }, factor: 0, fromDate: in90 },
      ],
    },
    {
      id: 'preset-raise',
      name: 'Gehaltserhöhung +5 %',
      description: 'Das Haupteinkommen steigt dauerhaft um 5 %.',
      modifiers: [
        { id: 'm1', type: 'flow', flowSelector: { kind: 'largestIncome' }, factor: 1.05 },
      ],
    },
    {
      id: 'preset-job-change',
      name: 'Jobwechsel',
      description: 'Das alte Haupteinkommen endet, ein neues startet nach einer kurzen Pause.',
      modifiers: [
        { id: 'm1', type: 'flow', flowSelector: { kind: 'largestIncome' }, factor: 0, fromDate: in30 },
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
        { id: 'm1', type: 'flow', flowSelector: { kind: 'largestIncome' }, factor: 0.7, fromDate: in42 },
      ],
    },
    {
      id: 'preset-big-purchase',
      name: 'Große Anschaffung',
      description: 'Einmalige Ausgabe von 3.000 € in 3 Monaten.',
      modifiers: [
        { id: 'm1', type: 'oneTime', amount: -3000, date: in90, label: 'Große Anschaffung' },
      ],
    },
    {
      id: 'preset-rent-increase',
      name: 'Mieterhöhung',
      description: 'Der größte Fixkosten-Eintrag (meist die Miete) steigt um 15 %.',
      modifiers: [
        { id: 'm1', type: 'flow', flowSelector: { kind: 'largestExpense' }, factor: 1.15, fromDate: in30 },
      ],
    },
    {
      id: 'preset-parental-leave',
      name: 'Elternzeit',
      description: 'Elterngeld ersetzt nur ~65 % des letzten Nettogehalts – das Haupteinkommen sinkt bis zur Rückkehr.',
      modifiers: [
        { id: 'm1', type: 'flow', flowSelector: { kind: 'largestIncome' }, factor: 0.65, fromDate: in30 },
      ],
    },
    {
      id: 'preset-alimony-loss',
      name: 'Unterhalt fällt weg',
      description: 'Die erkannte Unterhaltszahlung bleibt aus – nur dieser Eintrag entfällt.',
      modifiers: [
        { id: 'm1', type: 'flow', flowSelector: { kind: 'keyword', keyword: 'unterhalt', direction: 'income' }, factor: 0, fromDate: in14 },
      ],
    },
  ];
}
