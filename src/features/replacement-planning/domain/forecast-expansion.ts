import { format, addDays, parseISO } from 'date-fns';
import { toMajor } from '@/lib/money';
import type { ForecastTransfer, PlannedForecastEvent } from '@/lib/forecast-types';
import { buildReplacementViewModel, type ReplacementConfig, type ReplacementPlan } from './replacement-plan';

const ISO = 'yyyy-MM-dd';

export interface ReplacementExpansion {
  transfers: ForecastTransfer[];
  events: PlannedForecastEvent[];
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
  const config: ReplacementConfig = { today: startISO, inflationRate: options.inflationRate };

  for (const plan of plans) {
    const vm = buildReplacementViewModel(plan, config);
    // Vergangene Ersatztermine lassen sich nicht in die Zukunft prognostizieren.
    if (vm.replacementDate < startISO) continue;

    const eventAccount = plan.reserve_account_id ?? defaultOperatingAccountId;
    if (!eventAccount) continue; // Ohne Konto lässt sich der Posten nicht platzieren.

    // (c) Ersatz-Cashflow — der einzige saldowirksame Abfluss.
    events.push({
      id: `rp-${plan.id}-expense`,
      name: plan.name,
      amount: -Math.abs(toMajor(vm.cashflow.outflowMinor)),
      date: vm.replacementDate,
      accountId: eventAccount,
      category: plan.category,
    });

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

  return { transfers, events };
}
