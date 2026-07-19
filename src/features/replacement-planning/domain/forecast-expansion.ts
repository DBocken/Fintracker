import { format, addDays, parseISO } from 'date-fns';
import { toMajor } from '@/lib/money';
import type {
  ForecastTransfer,
  PlannedForecastEvent,
  ProbabilisticPlannedEvent,
} from '@/lib/forecast-types';
import {
  buildReplacementViewModel,
  priceUncertaintyCv,
  type ReplacementConfig,
  type ReplacementPlan,
} from './replacement-plan';

const ISO = 'yyyy-MM-dd';

function hasReplacementWindow(plan: ReplacementPlan): boolean {
  return Boolean(
    plan.earliest_replacement_date &&
      plan.likely_replacement_date &&
      plan.latest_replacement_date,
  );
}

export interface ReplacementExpansion {
  transfers: ForecastTransfer[];
  events: PlannedForecastEvent[];
  /** Probabilistische Ersatzereignisse (Pläne mit vollständigem Fenster, A3). */
  probabilisticEvents: ProbabilisticPlannedEvent[];
}

/**
 * Expandiert Ersatzpläne in die vorhandenen Forecast-Primitive — GENAU nach dem
 * Muster von `expandSinkingFunds`, damit der deterministische Kern
 * (`src/lib/forecast.ts`) unangetastet bleibt (AD2). Pro Plan:
 *  - (b) monatlicher Rücklagen-Transfer (kontoneutral, Invariante 2),
 *  - (c) Ersatz-Event = einziger saldowirksamer Abfluss (Invariante 1),
 *  - (c) Restwert als SEPARATER Zufluss-Event (kein Netting, Entscheidung D5).
 *
 * (a) Die ökonomischen Nutzungskosten sind reine Analytik und tauchen hier
 * BEWUSST NICHT auf (Invariante 22) — sonst würden dieselben Kosten doppelt
 * bzw. dreifach erfasst.
 *
 * Beträge werden von Cent (Entität) nach Euro (Forecast-Domäne) konvertiert.
 */
export function expandReplacementPlans(
  plans: ReplacementPlan[],
  startISO: string,
  defaultOperatingAccountId: string | null,
  options: { inflationRate?: number } = {},
): ReplacementExpansion {
  const transfers: ForecastTransfer[] = [];
  const events: PlannedForecastEvent[] = [];
  const probabilisticEvents: ProbabilisticPlannedEvent[] = [];
  const config: ReplacementConfig = { today: startISO, inflationRate: options.inflationRate };

  for (const plan of plans) {
    const windowed = hasReplacementWindow(plan);
    // Bei Fenster rechnet die Sicht mit dem wahrscheinlichen Termin.
    const effectivePlan = windowed
      ? { ...plan, planned_replacement_date: plan.likely_replacement_date }
      : plan;
    const vm = buildReplacementViewModel(effectivePlan, config);
    // Vergangene Ersatztermine lassen sich nicht in die Zukunft prognostizieren.
    if (vm.replacementDate < startISO) continue;

    const eventAccount = plan.reserve_account_id ?? defaultOperatingAccountId;
    if (!eventAccount) continue; // Ohne Konto lässt sich der Posten nicht platzieren.

    const outflowEuros = -Math.abs(toMajor(vm.cashflow.outflowMinor));

    if (windowed) {
      // (c) Probabilistisches Ersatzereignis: unsicheres Datum (Fenster) + Preis.
      probabilisticEvents.push({
        id: `rp-${plan.id}`,
        name: plan.name,
        amountMean: outflowEuros,
        amountCv: priceUncertaintyCv(plan),
        earliestDate: plan.earliest_replacement_date as string,
        likelyDate: plan.likely_replacement_date as string,
        latestDate: plan.latest_replacement_date as string,
        accountId: eventAccount,
        category: plan.category,
      });
    } else {
      // (c) Fester Ersatz-Cashflow — der einzige saldowirksame Abfluss (A2).
      events.push({
        id: `rp-${plan.id}-expense`,
        name: plan.name,
        amount: outflowEuros,
        date: vm.replacementDate,
        accountId: eventAccount,
        category: plan.category,
      });
    }

    // (c) Restwert als SEPARATER Zufluss — kein Netting gegen den Abfluss.
    if (vm.cashflow.residualInflowMinor > 0) {
      events.push({
        id: `rp-${plan.id}-residual`,
        name: `${plan.name} (Restwert)`,
        amount: Math.abs(toMajor(vm.cashflow.residualInflowMinor)),
        date: vm.replacementDate,
        accountId: eventAccount,
        category: plan.category,
      });
    }

    // (b) Rücklagen-Transfer nur bei explizitem Reservekonto + Finanzierungsquelle
    // und noch offenem Beitragsbedarf. Beiträge enden am Tag vor dem Ersatz.
    const fundedFrom = plan.funded_from_account_id ?? defaultOperatingAccountId;
    const contributionEuros = toMajor(vm.monthlyReserveContributionMinor);
    const contribEnd = format(addDays(parseISO(vm.replacementDate), -1), ISO);
    if (
      plan.reserve_account_id &&
      fundedFrom &&
      fundedFrom !== plan.reserve_account_id &&
      contributionEuros > 0 &&
      contribEnd >= startISO
    ) {
      transfers.push({
        id: `rp-${plan.id}-contrib`,
        name: `Ersatzrücklage: ${plan.name}`,
        amount: contributionEuros,
        fromAccountId: fundedFrom,
        toAccountId: plan.reserve_account_id,
        cadence: 'monthly',
        anchorDate: startISO,
        endDate: contribEnd,
      });
    }
  }

  return { transfers, events, probabilisticEvents };
}
