/**
 * FinRisk – „Frag dein Geld" (Inverse Monte-Carlo / Leistbarkeit).
 *
 * Dreht die Simulation um: Statt „so sieht deine Zukunft aus" beantwortet sie
 * „kann ich mir X zum Zeitpunkt Y leisten?" – und zwar NICHT mit Ja/Nein, sondern
 * mit einem **Trade-off-Menü**: mehrere konkrete Wege zum Ziel, jeder mit ehrlicher
 * Erfolgswahrscheinlichkeit und schlimmstem Tag.
 *
 * Mechanik: Die Vorwärts-Engine ({@link runMonteCarloForecast}) ist der Bewerter;
 * „invertiert" wird per Suche – für jeden Hebel (später kaufen, weniger ausgeben,
 * mehr verdienen) die KLEINSTE Änderung finden, die die Zielsicherheit erreicht.
 *
 * Erfolg = Anteil der Pfade, die nie unter den Sicherheitspuffer fallen
 * (= 1 − Pufferbruch-Wahrscheinlichkeit). Reine Logik, mit festem Seed
 * reproduzierbar und testbar.
 */
import { addDays, format } from 'date-fns';
import { runMonteCarloForecast } from '../forecast-montecarlo';
import { pickVariableExpenseAccount } from '../forecast';
import type { ForecastConfig, ForecastInput, PlannedForecastEvent, RecurringFlow } from '../forecast-types';
import type { MonteCarloConfig } from '../forecast-montecarlo-types';

const ISO = 'yyyy-MM-dd';

/** Die geplante Ausgabe, deren Leistbarkeit geprüft wird. */
export interface AffordabilityGoal {
  /** Betrag der Ausgabe (positiv, EUR). */
  amount: number;
  /** Tagindex ab Start (0-basiert). */
  dayIndex: number;
  /** Optionales Label („Thailand"). */
  label?: string;
}

export interface AffordabilityOptions {
  /** Zielsicherheit (0..1). Default 0.9. */
  targetConfidence?: number;
  /** Monte-Carlo-Parameter der Suche (kleiner = schneller). */
  monteCarlo?: MonteCarloConfig;
}

export type AffordabilityLever = 'asis' | 'delay' | 'cut' | 'earn';

/** Maschinenlesbarer Parameter einer Empfehlung. */
export type AffordabilityDetail =
  | { kind: 'asis' }
  | { kind: 'delay'; newDayIndex: number; extraDays: number }
  | { kind: 'cut'; perMonth: number }
  | { kind: 'earn'; perMonth: number };

/** Ein Weg zum Ziel im Trade-off-Menü. */
export interface AffordabilityOption {
  lever: AffordabilityLever;
  /** Erreichte (gerechnete) Erfolgswahrscheinlichkeit 0..1. */
  successProbability: number;
  /** Erreicht diese Option die Zielsicherheit? */
  meetsTarget: boolean;
  detail: AffordabilityDetail;
  /** Schlimmster Tag (Index in der Tagesachse) im pessimistischen Pfad. */
  worstDayIndex: number;
  /** Saldo am schlimmsten Tag (P10, EUR). */
  worstValue: number;
}

export interface AffordabilityResult {
  goal: AffordabilityGoal;
  targetConfidence: number;
  /** Erfolgswahrscheinlichkeit, wenn man einfach kauft (ohne Änderung). */
  baseSuccess: number;
  /** Reicht „einfach kaufen" für die Zielsicherheit? */
  affordableAsIs: boolean;
  /** Optionen, beste/schmerzärmste zuerst. Bei `affordableAsIs` nur `asis`. */
  options: AffordabilityOption[];
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Default-Monte-Carlo der Suche: schlank, geglättet (schnell genug für viele Läufe). */
function searchMc(mc?: MonteCarloConfig): MonteCarloConfig {
  return { trials: 300, seed: 1, occurrenceSampling: false, ...mc };
}

/** Summe der geplanten variablen Monatsausgaben (Budget-Override hat Vorrang). */
function totalVariableMonthly(input: ForecastInput): number {
  return (input.variableExpenses ?? []).reduce((s, b) => s + (b.budgetOverride ?? b.monthlyAmount), 0);
}

/** Kopie mit zusätzlicher Einmal-Ausgabe (die geprüfte Anschaffung). */
function withPurchase(
  input: ForecastInput,
  amount: number,
  dayIndex: number,
  startISO: string,
  accountId: string,
): ForecastInput {
  const date = format(addDays(new Date(`${startISO}T00:00:00Z`), dayIndex), ISO);
  const event: PlannedForecastEvent = {
    id: 'affordability-goal',
    name: 'Anschaffung',
    amount: -Math.abs(amount),
    date,
    accountId,
  };
  return { ...input, plannedEvents: [...(input.plannedEvents ?? []), event] };
}

/** Kopie mit auf `factor` skalierten variablen Ausgaben (factor < 1 = Sparen). */
function withVariableScale(input: ForecastInput, factor: number): ForecastInput {
  return {
    ...input,
    variableExpenses: (input.variableExpenses ?? []).map((b) => ({
      ...b,
      monthlyAmount: round2(b.monthlyAmount * factor),
      budgetOverride: b.budgetOverride != null ? round2(b.budgetOverride * factor) : undefined,
    })),
  };
}

/** Kopie mit zusätzlichem monatlichen Einkommen. */
function withExtraIncome(
  input: ForecastInput,
  perMonth: number,
  startISO: string,
  accountId: string,
): ForecastInput {
  const flow: RecurringFlow = {
    id: 'affordability-extra-income',
    name: 'Mehr-Einkommen',
    amount: Math.abs(perMonth),
    cadence: 'monthly',
    anchorDate: startISO,
    accountId,
  };
  return { ...input, recurringFlows: [...(input.recurringFlows ?? []), flow] };
}

interface Evaluated {
  success: number;
  worstDayIndex: number;
  worstValue: number;
}

/** Erfolgswahrscheinlichkeit (1 − Pufferbruch) + schlimmster Tag (min P10). */
function evaluate(input: ForecastInput, config: ForecastConfig, mc: MonteCarloConfig): Evaluated {
  const res = runMonteCarloForecast(input, config, mc);
  let worstValue = Number.POSITIVE_INFINITY;
  let worstDayIndex = 0;
  res.band.forEach((b, i) => {
    if (b.p10 < worstValue) {
      worstValue = b.p10;
      worstDayIndex = i;
    }
  });
  return { success: round2(1 - res.breachProbability), worstDayIndex, worstValue: round2(worstValue) };
}

/**
 * Bewertet die Leistbarkeit eines Ziels und liefert das Trade-off-Menü.
 *
 * @param input  Forecast-Eingaben (override-bereinigt).
 * @param config Horizont/Puffer/Start. `safetyBuffer` definiert „sicher".
 * @param goal   Betrag + Tagindex der geplanten Ausgabe.
 */
export function evaluateAffordability(
  input: ForecastInput,
  config: ForecastConfig,
  goal: AffordabilityGoal,
  options: AffordabilityOptions = {},
): AffordabilityResult {
  const target = Math.min(0.999, Math.max(0.5, options.targetConfidence ?? 0.9));
  const mc = searchMc(options.monteCarlo);
  const startISO = config.startDate ?? format(new Date(), ISO);
  const accountId = pickVariableExpenseAccount(input.accounts);

  // Horizont so wählen, dass auch ein verschobenes Ziel + Erholung sichtbar bleibt.
  const neededMonths = Math.ceil((goal.dayIndex + 120) / 30);
  const cfg: ForecastConfig = { ...config, months: Math.max(config.months ?? 6, neededMonths) };

  // Ohne Konto (kein Zahlungskonto) ist keine sinnvolle Aussage möglich.
  if (!accountId) {
    return { goal, targetConfidence: target, baseSuccess: 0, affordableAsIs: false, options: [] };
  }

  const base = evaluate(withPurchase(input, goal.amount, goal.dayIndex, startISO, accountId), cfg, mc);
  const asIs: AffordabilityOption = {
    lever: 'asis',
    successProbability: base.success,
    meetsTarget: base.success >= target,
    detail: { kind: 'asis' },
    worstDayIndex: base.worstDayIndex,
    worstValue: base.worstValue,
  };

  // Schon ohne Änderung sicher genug -> kein Menü nötig.
  if (asIs.meetsTarget) {
    return { goal, targetConfidence: target, baseSuccess: base.success, affordableAsIs: true, options: [asIs] };
  }

  const menu: AffordabilityOption[] = [asIs];

  // 1) Später kaufen: ersten Aufschub finden, der die Zielsicherheit erreicht.
  for (const extraDays of [14, 30, 60, 90]) {
    const newDay = goal.dayIndex + extraDays;
    const ev = evaluate(withPurchase(input, goal.amount, newDay, startISO, accountId), cfg, mc);
    if (ev.success >= target) {
      menu.push({
        lever: 'delay',
        successProbability: ev.success,
        meetsTarget: true,
        detail: { kind: 'delay', newDayIndex: newDay, extraDays },
        worstDayIndex: ev.worstDayIndex,
        worstValue: ev.worstValue,
      });
      break;
    }
  }

  // 2) Weniger ausgeben: kleinste Drosselung (größtes factor) finden, die reicht.
  const varMonthly = totalVariableMonthly(input);
  if (varMonthly > 0) {
    const evalCut = (factor: number) =>
      evaluate(
        withPurchase(withVariableScale(input, factor), goal.amount, goal.dayIndex, startISO, accountId),
        cfg,
        mc,
      );
    let lo = 0; // alles gestrichen (max. Erfolg)
    let hi = 1; // nichts gestrichen (= as-is, reicht nicht)
    let best: Evaluated | null = null;
    if (evalCut(lo).success >= target) {
      for (let i = 0; i < 6; i++) {
        const mid = (lo + hi) / 2;
        const ev = evalCut(mid);
        if (ev.success >= target) {
          lo = mid;
          best = ev;
        } else {
          hi = mid;
        }
      }
      const factor = lo;
      const ev = best ?? evalCut(factor);
      menu.push({
        lever: 'cut',
        successProbability: ev.success,
        meetsTarget: true,
        detail: { kind: 'cut', perMonth: round2((1 - factor) * varMonthly) },
        worstDayIndex: ev.worstDayIndex,
        worstValue: ev.worstValue,
      });
    }
  }

  // 3) Mehr verdienen: kleinstes Zusatz-Einkommen finden, das reicht.
  const evalEarn = (perMonth: number) =>
    evaluate(
      withPurchase(withExtraIncome(input, perMonth, startISO, accountId), goal.amount, goal.dayIndex, startISO, accountId),
      cfg,
      mc,
    );
  const upper = Math.max(100, goal.amount); // großzügige Obergrenze
  if (evalEarn(upper).success >= target) {
    let lo = 0;
    let hi = upper;
    let best: Evaluated | null = null;
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2;
      const ev = evalEarn(mid);
      if (ev.success >= target) {
        hi = mid;
        best = ev;
      } else {
        lo = mid;
      }
    }
    const ev = best ?? evalEarn(hi);
    menu.push({
      lever: 'earn',
      successProbability: ev.success,
      meetsTarget: true,
      detail: { kind: 'earn', perMonth: round2(hi) },
      worstDayIndex: ev.worstDayIndex,
      worstValue: ev.worstValue,
    });
  }

  // Schmerzärmste zuerst: erreichte Optionen nach Erfolg, as-is bleibt vorn als Referenz.
  const ranked = menu
    .slice(1)
    .sort((a, b) => b.successProbability - a.successProbability);
  return {
    goal,
    targetConfidence: target,
    baseSuccess: base.success,
    affordableAsIs: false,
    options: [asIs, ...ranked],
  };
}
